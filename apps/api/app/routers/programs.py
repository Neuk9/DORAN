from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query

from app.core.db import get_db
from app.models.schemas import ApiResponse, CategoryType, CostType, ProgramOut
from app.services.eligibility import is_program_open
from app.services.gap import serialize_program
from app.services.kakao_places import fetch_nearby_public_places

router = APIRouter(prefix="/api/programs", tags=["programs"])
KST = timezone(timedelta(hours=9))


@router.get("", response_model=ApiResponse)
async def list_programs(
    category: CategoryType | None = None,
    costType: CostType | None = None,
    timeSlot: str | None = None,
    sigungu: str | None = None,
    admCd: str | None = None,
    q: str | None = None,
    includeClosed: bool = False,
    includeOnline: bool = False,
    lat: float | None = None,
    lng: float | None = None,
    radiusKm: float = Query(default=5.0, ge=0.5, le=50.0),
    limit: int = Query(default=30, ge=1, le=100),
) -> ApiResponse:
    db = get_db()
    match_filter: dict[str, Any] = {}

    if category:
        match_filter["category"] = category
    if costType:
        match_filter["cost.type"] = costType
    if timeSlot:
        match_filter["schedule.timeSlots"] = timeSlot
    if admCd:
        match_filter["$or"] = [
            {"region.admCd": admCd},
            {"region.admCd": f"{admCd[:5]}00000"},
            {"region.isNationwide": True},
        ]
    elif sigungu:
        match_filter["$or"] = [
            {"region.sigungu": sigungu},
            {"region.isNationwide": True},
        ]
    if q and q.strip():
        keyword = q.strip()
        text_or = [
            {"title": {"$regex": keyword, "$options": "i"}},
            {"summary": {"$regex": keyword, "$options": "i"}},
            {"tags": {"$regex": keyword, "$options": "i"}},
            {"provider": {"$regex": keyword, "$options": "i"}},
        ]
        if "$or" in match_filter:
            match_filter = {"$and": [match_filter, {"$or": text_or}]}
        else:
            match_filter["$or"] = text_or

    programs: list[ProgramOut] = []

    if lat is not None and lng is not None:
        pipeline: list[dict[str, Any]] = [
            {
                "$geoNear": {
                    "near": {"type": "Point", "coordinates": [lng, lat]},
                    "distanceField": "distMeters",
                    "maxDistance": int(radiusKm * 1000),
                    "spherical": True,
                    "query": match_filter,
                }
            },
            {"$limit": limit},
        ]
        cursor = await db["programs"].aggregate(pipeline)
        async for doc in cursor:
            dist_m = doc.pop("distMeters", None)
            prog = serialize_program(doc)
            if dist_m is not None:
                prog.distanceKm = round(float(dist_m) / 1000.0, 2)
            programs.append(prog)

        # 실시간 카카오 공공시설 보강 (전국 어디서든 내 위치 주변 공공시설 표시)
        live_places = await fetch_nearby_public_places(
            lat=lat,
            lng=lng,
            categories=[category] if category else None,
            keywords=[q.strip()] if q and q.strip() else None,
            radius_m=int(radiusKm * 1000),
            limit=8,
            db=db,
        )
        existing_titles = {p.provider for p in programs}
        for place in live_places:
            if place.provider not in existing_titles:
                programs.append(place)
                existing_titles.add(place.provider)
        programs.sort(key=lambda p: p.distanceKm if p.distanceKm is not None else 999.0)

        if includeOnline:
            geo_cap = max(limit - 6, 8)
            programs = programs[:geo_cap]
            online_filter = (
                {
                    "$and": [
                        match_filter,
                        {"$or": [{"location": {"$exists": False}}, {"location": None}]},
                    ]
                }
                if match_filter
                else {"$or": [{"location": {"$exists": False}}, {"location": None}]}
            )
            seen_ids = {p.id for p in programs}
            online_cursor = db["programs"].find(online_filter).limit(6)
            async for doc in online_cursor:
                prog = serialize_program(doc)
                if prog.id not in seen_ids:
                    programs.append(prog)
                    seen_ids.add(prog.id)
    else:
        cursor = db["programs"].find(match_filter).limit(limit * 2)
        async for doc in cursor:
            programs.append(serialize_program(doc))

    now_kst = datetime.now(KST)
    if not includeClosed:
        programs = [p for p in programs if is_program_open(p, now=now_kst)]

    programs = programs[:limit]
    return ApiResponse(
        data=[p.model_dump(mode="json") for p in programs],
        meta={"count": len(programs), "includeClosed": includeClosed},
    )


@router.get("/{program_id}", response_model=ApiResponse)
async def get_program(program_id: str) -> ApiResponse:
    db = get_db()
    doc = None
    if ObjectId.is_valid(program_id):
        doc = await db["programs"].find_one({"_id": ObjectId(program_id)})
    if doc is None:
        doc = await db["programs"].find_one({"externalId": program_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="프로그램을 찾을 수 없습니다.")

    prog = serialize_program(doc)
    return ApiResponse(
        data=prog.model_dump(mode="json"),
        meta={"isOpen": is_program_open(prog)},
    )
