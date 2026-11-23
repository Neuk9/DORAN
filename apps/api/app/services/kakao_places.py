"""카카오 로컬 API 기반 실시간 역지오코딩 및 사용자 위치 주변 공공시설 조회 서비스."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import httpx
from pymongo import UpdateOne
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.models.schemas import (
    ApplyInfo,
    CategoryType,
    EligibilityRule,
    GeoPoint,
    ProgramCost,
    ProgramOut,
    ProgramRegion,
    ProgramSchedule,
    SourceInfo,
)

KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
KAKAO_REGION_URL = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json"

EXCLUDED_PRIVATE_KEYWORDS = ("이마트", "롯데마트", "홈플러스", "백화점", "아울렛", "학원", "교습소")


async def reverse_geocode(lat: float, lng: float) -> dict[str, str] | None:
    """좌표(lat, lng)를 실제 행정동(sido, sigungu, dong, admCd)으로 변환합니다."""
    if not settings.kakao_api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                KAKAO_REGION_URL,
                headers={"Authorization": f"KakaoAK {settings.kakao_api_key.strip()}"},
                params={"x": lng, "y": lat},
            )
            if resp.status_code != 200:
                return None
            docs = resp.json().get("documents") or []
            # 행정동('H') 우선, 없으면 법정동('B')
            chosen = next((d for d in docs if d.get("region_type") == "H"), docs[0] if docs else None)
            if not chosen:
                return None
            return {
                "sido": chosen.get("region_1depth_name", ""),
                "sigungu": chosen.get("region_2depth_name", ""),
                "dong": chosen.get("region_3depth_name", ""),
                "admCd": chosen.get("code", ""),
            }
    except Exception:
        return None


def _build_search_queries(
    categories: list[CategoryType] | None = None,
    keywords: list[str] | None = None,
) -> list[tuple[str, CategoryType]]:
    """사용자 의도에 맞는 공공시설 검색 키워드 목록을 구성합니다."""
    kw_text = " ".join(keywords or [])
    queries: list[tuple[str, CategoryType]] = []

    if any(w in kw_text for w in ("악기", "기타", "피아노", "음악", "공연", "취미", "문화")):
        queries.append(("생활문화센터", "culture"))
        queries.append(("구민회관", "culture"))
    if any(w in kw_text for w in ("청년", "대학생", "취업", "창업")):
        queries.append(("청년센터", "welfare"))
    if any(w in kw_text for w in ("어르신", "노인", "돌봄", "고령")):
        queries.append(("노인복지관", "welfare"))
    if any(w in kw_text for w in ("도서", "공부", "열람", "영어", "코딩", "스마트폰", "교육", "배우", "강좌")):
        queries.append(("공공도서관", "education"))
        queries.append(("평생학습관", "education"))
    if any(w in kw_text for w in ("아이", "어린이", "육아", "가족", "다문화")):
        queries.append(("가족센터", "welfare"))

    cats = set(categories or [])
    if not queries:
        if not cats or "welfare" in cats:
            queries.append(("종합사회복지관", "welfare"))
            queries.append(("행정복지센터", "welfare"))
        if not cats or "education" in cats:
            queries.append(("공공도서관", "education"))
        if not cats or "culture" in cats:
            queries.append(("생활문화센터", "culture"))
    else:
        # 기본 공공 거점 1~2개 보강
        if "welfare" in cats and not any(c == "welfare" for _, c in queries):
            queries.append(("행정복지센터", "welfare"))
        if "education" in cats and not any(c == "education" for _, c in queries):
            queries.append(("공공도서관", "education"))

    # 중복 제거, 최대 4개 병렬 호출
    deduped: list[tuple[str, CategoryType]] = []
    seen: set[str] = set()
    for q, cat in queries:
        if q not in seen:
            seen.add(q)
            deduped.append((q, cat))
    return deduped[:4]


async def _search_kakao_keyword(
    client: httpx.AsyncClient,
    query: str,
    category: CategoryType,
    lat: float,
    lng: float,
    radius_m: int,
) -> list[ProgramOut]:
    resp = await client.get(
        KAKAO_KEYWORD_URL,
        headers={"Authorization": f"KakaoAK {settings.kakao_api_key.strip()}"},
        params={
            "query": query,
            "x": lng,
            "y": lat,
            "radius": min(radius_m, 20000),
            "size": 4,
            "sort": "distance",
        },
    )
    if resp.status_code != 200:
        return []

    now = datetime.now(UTC)
    results: list[ProgramOut] = []
    for doc in resp.json().get("documents") or []:
        name = (doc.get("place_name") or "").strip()
        if not name or any(bad in name for bad in EXCLUDED_PRIVATE_KEYWORDS):
            continue
        place_id = doc.get("id")
        x = doc.get("x")
        y = doc.get("y")
        if not place_id or not x or not y:
            continue

        address = (doc.get("road_address_name") or doc.get("address_name") or "").strip()
        addr_parts = address.split()
        sido = addr_parts[0] if len(addr_parts) >= 1 else ""
        sigungu = addr_parts[1] if len(addr_parts) >= 2 else ""
        dong = addr_parts[2] if len(addr_parts) >= 3 else None

        dist_m = doc.get("distance")
        dist_km = round(float(dist_m) / 1000.0, 2) if dist_m else None
        phone = (doc.get("phone") or "").strip() or None
        place_url = (doc.get("place_url") or "").strip() or None
        cat_name = (doc.get("category_name") or "").split(">")[-1].strip()

        summary_map = {
            "welfare": f"내 위치 인근의 공공 복지·민원 거점({cat_name or query})으로, 복지 상담·지원 신청 및 지역 돌봄 연계를 받을 수 있습니다.",
            "education": f"내 위치 인근의 공공 학습 공간({cat_name or query})으로, 주민 무료 강좌·열람실·평생교육 프로그램을 이용할 수 있습니다.",
            "culture": f"내 위치 인근의 지역 문화 거점({cat_name or query})으로, 생활문화 동아리·공연·공간 대관 등을 이용할 수 있습니다.",
        }

        results.append(
            ProgramOut(
                id=f"kakao-{place_id}",
                externalId=f"kakao:{place_id}",
                category=category,
                title=f"{name} ({query} 이용·상담)",
                summary=summary_map[category],
                provider=name,
                region=ProgramRegion(
                    sido=sido or "대한민국",
                    sigungu=sigungu or "현재 지역",
                    dong=dong,
                    admCd="0000000000",
                    isNationwide=False,
                ),
                location=GeoPoint(type="Point", coordinates=[float(x), float(y)]),
                address=address or None,
                cost=ProgramCost(
                    type="free",
                    amount=0,
                    description="공공시설 기본 이용 무료 (세부 프로그램별 확인)",
                ),
                schedule=ProgramSchedule(
                    days=["mon", "tue", "wed", "thu", "fri", "sat"],
                    timeSlots=["weekday_day", "weekend"],
                    hoursText="시설별 운영시간 상이 (방문 전 확인)",
                ),
                deadline=None,
                isAlwaysOpen=True,
                eligibility=EligibilityRule(
                    minAge=None,
                    maxAge=None,
                    targetGroups=["general"],
                    incomeMaxPct=None,
                    requiresVerification=[],
                    requiredDocs=["신분증"],
                ),
                applyInfo=ApplyInfo(
                    method="현장 방문 또는 기관 전화·홈페이지 예약",
                    url=place_url,
                    phone=phone,
                ),
                source=SourceInfo(name="카카오 로컬 공공시설 연계", syncedAt=now),
                tags=[query, cat_name or query, sigungu, "주변시설", "무료"],
                distanceKm=dist_km,
            )
        )
    return results


async def fetch_nearby_public_places(
    lat: float,
    lng: float,
    categories: list[CategoryType] | None = None,
    keywords: list[str] | None = None,
    radius_m: int = 4000,
    limit: int = 8,
    db: AsyncDatabase | None = None,
) -> list[ProgramOut]:
    """사용자 GPS/지도 좌표 주변 실제 공공시설을 카카오 로컬 API로 병렬 조회합니다."""
    if not settings.kakao_api_key:
        return []
    queries = _build_search_queries(categories=categories, keywords=keywords)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            batches = await asyncio.gather(
                *[
                    _search_kakao_keyword(client, q, cat, lat, lng, radius_m)
                    for q, cat in queries
                ],
                return_exceptions=True,
            )
    except Exception:
        return []

    merged: list[ProgramOut] = []
    seen_ids: set[str] = set()
    for batch in batches:
        if isinstance(batch, Exception):
            continue
        for item in batch:
            if item.id not in seen_ids:
                seen_ids.add(item.id)
                merged.append(item)

    merged.sort(key=lambda p: p.distanceKm if p.distanceKm is not None else 999.0)
    selected = merged[:limit]

    # DB가 전달되면 programs 컬렉션에 idempotent 업서트해 실제 ObjectId 부여 (상세·체크리스트 100% 호환)
    if db is not None and selected:
        now = datetime.now(UTC)
        ops = []
        ext_ids = []
        for item in selected:
            doc = item.model_dump(exclude={"id", "distanceKm"})
            ext_ids.append(item.externalId)
            ops.append(
                UpdateOne(
                    {"externalId": item.externalId},
                    {"$set": doc, "$setOnInsert": {"createdAt": now}},
                    upsert=True,
                )
            )
        await db["programs"].bulk_write(ops, ordered=False)
        id_map: dict[str, str] = {}
        async for row in db["programs"].find({"externalId": {"$in": ext_ids}}, {"_id": 1, "externalId": 1}):
            id_map[row["externalId"]] = str(row["_id"])
        for item in selected:
            if item.externalId in id_map:
                item.id = id_map[item.externalId]

    return selected
