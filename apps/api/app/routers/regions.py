from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.core.db import get_db
from app.ingest.sync_public import sync_all_public_data
from app.models.schemas import ApiResponse, RegionStatOut
from app.services.gap import build_region_report
from app.services.kakao_places import reverse_geocode

router = APIRouter(prefix="/api/regions", tags=["regions"])


@router.post("/sync", response_model=ApiResponse)
async def trigger_public_sync() -> ApiResponse:
    """공공데이터포털 4종 오픈API + 카카오 로컬 실데이터를 즉시 동기화하고 격차 지수를 재산출합니다."""
    if not settings.data_go_kr_key:
        raise HTTPException(
            status_code=503,
            detail="서버에 DATA_GO_KR_KEY가 설정되어 있지 않아 공공 API 동기화를 실행할 수 없습니다.",
        )
    db = get_db()
    summary = await sync_all_public_data(db)
    return ApiResponse(data=summary, meta={"synced": True})


@router.get("", response_model=ApiResponse)
async def list_regions(sigungu: str | None = None) -> ApiResponse:
    db = get_db()
    query = {"sigungu": sigungu} if sigungu else {}
    cursor = db["region_stats"].find(query).sort("scores.gapIndex", -1)
    regions: list[dict] = []
    async for doc in cursor:
        doc.pop("_id", None)
        regions.append(RegionStatOut.model_validate(doc).model_dump(mode="json"))
    return ApiResponse(data=regions, meta={"count": len(regions)})


@router.get("/nearest", response_model=ApiResponse)
async def get_nearest_region(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
) -> ApiResponse:
    """사용자 GPS 좌표(lat, lng)에서 가장 가까운 행정동을 반환합니다."""
    db = get_db()
    pipeline = [
        {
            "$geoNear": {
                "near": {"type": "Point", "coordinates": [lng, lat]},
                "distanceField": "distMeters",
                "spherical": True,
            }
        },
        {"$limit": 1},
    ]
    cursor = await db["region_stats"].aggregate(pipeline)
    nearest_doc = None
    async for doc in cursor:
        nearest_doc = doc
        break

    if nearest_doc is None:
        raise HTTPException(status_code=404, detail="등록된 행정동 데이터가 없습니다.")

    dist_km = round(float(nearest_doc.pop("distMeters", 0.0)) / 1000.0, 2)
    nearest_doc.pop("_id", None)
    region = RegionStatOut.model_validate(nearest_doc)
    in_service_area = dist_km <= 25.0
    actual_region = await reverse_geocode(lat, lng)
    return ApiResponse(
        data={
            "region": region.model_dump(mode="json"),
            "actualRegion": actual_region,
            "distanceKm": dist_km,
            "inServiceArea": in_service_area,
        },
        meta={"lat": lat, "lng": lng},
    )


@router.get("/{adm_cd}/report", response_model=ApiResponse)
async def get_region_report(adm_cd: str) -> ApiResponse:
    db = get_db()
    report = await build_region_report(db, adm_cd)
    if report is None:
        raise HTTPException(status_code=404, detail="해당 행정동 통계 데이터를 찾을 수 없습니다.")
    return ApiResponse(data=report.model_dump(mode="json"), meta={"admCd": adm_cd})
