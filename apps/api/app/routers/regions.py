from fastapi import APIRouter, HTTPException, Query

from app.core.db import get_db
from app.models.schemas import ApiResponse, RegionStatOut
from app.services.gap import build_region_report

router = APIRouter(prefix="/api/regions", tags=["regions"])


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
    return ApiResponse(
        data={
            "region": region.model_dump(mode="json"),
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
