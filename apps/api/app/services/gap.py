from pymongo.asynchronous.database import AsyncDatabase

from app.models.schemas import (
    ProgramOut,
    RegionReportOut,
    RegionStatOut,
    RegionSupply,
)

CATEGORY_KR = {
    "welfare": "복지",
    "education": "교육",
    "culture": "문화",
}


def serialize_program(doc: dict) -> ProgramOut:
    data = dict(doc)
    data["id"] = str(data.pop("_id"))
    data.setdefault("location", None)
    return ProgramOut.model_validate(data)


async def build_region_report(db: AsyncDatabase, adm_cd: str) -> RegionReportOut | None:
    region_doc = await db["region_stats"].find_one({"admCd": adm_cd})
    if not region_doc:
        return None
    region_doc.pop("_id", None)
    region = RegionStatOut.model_validate(region_doc)

    # 1) MongoDB Aggregation으로 해당 시군구·행정동 실시간 프로그램 공급 수 집계
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"region.admCd": adm_cd},
                    {"region.sigungu": region.sigungu},
                ]
            }
        },
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]
    counts_map = {"welfare": 0, "education": 0, "culture": 0}
    cursor = await db["programs"].aggregate(pipeline)
    async for row in cursor:
        cat = row.get("_id")
        if cat in counts_map:
            counts_map[cat] = int(row.get("count", 0))

    live_supply = RegionSupply(
        welfare=counts_map["welfare"],
        education=counts_map["education"],
        culture=counts_map["culture"],
        total=sum(counts_map.values()),
    )

    # 2) 최근 비식별 탐색 수요 신호 집계
    sig_pipeline = [
        {"$match": {"admCd": adm_cd}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]
    demand_signals: dict[str, int] = {"welfare": 0, "education": 0, "culture": 0}
    sig_cursor = await db["demand_signals"].aggregate(sig_pipeline)
    async for row in sig_cursor:
        cat = row.get("_id")
        if cat in demand_signals:
            demand_signals[cat] = int(row.get("count", 0))

    # 3) 해당 행정동 중심 좌표 기준 인근 자원 ($geoNear) 최대 6건 조회
    nearby_programs: list[ProgramOut] = []
    near_pipeline = [
        {
            "$geoNear": {
                "near": region.center.model_dump(),
                "distanceField": "distMeters",
                "maxDistance": 5000,
                "spherical": True,
            }
        },
        {"$limit": 6},
    ]
    near_cursor = await db["programs"].aggregate(near_pipeline)
    async for doc in near_cursor:
        dist_m = doc.pop("distMeters", None)
        prog = serialize_program(doc)
        if dist_m is not None:
            prog.distanceKm = round(float(dist_m) / 1000.0, 2)
        nearby_programs.append(prog)

    # 4) 정책·현장 상담 인사이트 생성
    insights: list[str] = []
    if region.scores.gapIndex >= 30:
        insights.append(
            f"{region.sigungu} {region.dong}의 수요·공급 격차 지수는 {region.scores.gapIndex}점으로 우선 지원 검토 지역입니다."
        )
    elif region.scores.gapIndex > 0:
        insights.append(
            f"{region.sigungu} {region.dong}은 수요({region.scores.demandIndex}) 대비 공급({region.scores.supplyIndex}) 보완이 필요합니다."
        )
    else:
        insights.append(
            f"{region.sigungu} {region.dong}은 전반적인 공공자원 접근성이 양호하며, 기존 시설 활용 홍보에 집중하는 것이 효과적입니다."
        )

    if region.scores.shortageCategories:
        shortage_names = ", ".join(CATEGORY_KR[c] for c in region.scores.shortageCategories)
        insights.append(
            f"특히 {shortage_names} 분야의 생활권 공급이 부족하므로 유휴 공공공간 개방 및 연계 프로그램 확충이 권장됩니다."
        )

    youth_ratio = round((region.population.youth / max(region.population.total, 1)) * 100, 1)
    senior_ratio = round((region.population.senior / max(region.population.total, 1)) * 100, 1)
    insights.append(
        f"인구 구성은 청년 {youth_ratio}%, 어르신 {senior_ratio}%, 취약계층 비율 {round(region.population.vulnerableRatio * 100, 1)}%입니다."
    )

    return RegionReportOut(
        region=region,
        liveProgramCounts=live_supply,
        recentDemandSignals=demand_signals,
        nearbyRecommended=nearby_programs,
        insights=insights,
    )
