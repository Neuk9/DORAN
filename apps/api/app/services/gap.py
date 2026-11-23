from pymongo.asynchronous.database import AsyncDatabase

from app.models.schemas import (
    CategoryType,
    ProgramOut,
    RecommendedFacility,
    RegionReportOut,
    RegionStatOut,
    RegionSupply,
)

CATEGORY_KR = {
    "welfare": "복지",
    "education": "교육",
    "culture": "문화",
}

FACILITY_BLUEPRINTS: list[dict] = [
    # --- 어르신(고령층) 필수 인프라 ---
    {
        "group": "senior",
        "name": "어르신 디지털·키오스크 평생학습 쉼터",
        "category": "education",
        "matchKeywords": ("스마트폰", "키오스크", "디지털", "어르신", "평생학습"),
        "delivery": "동 주민센터·경로당 유휴 공간을 활용한 주 2회 공유누리 디지털 교실 전환",
        "reasonTemplate": "{dong}은 65세 이상 어르신 비율이 {ratio}%({count:,}명)로 높지만, 동 내 어르신 대상 디지털·생활교육 거점이 부족합니다.",
    },
    {
        "group": "senior",
        "name": "시니어 건강체조·생활문화 사랑방",
        "category": "culture",
        "matchKeywords": ("체조", "노래", "시니어", "어르신", "문화"),
        "delivery": "자치회관·복합커뮤니티 유휴 시간대 개방을 통한 어르신 여가·건강 프로그램 신설",
        "reasonTemplate": "{dong}의 고령 인구({count:,}명, {ratio}%) 대비 일상 여가·건강 문화 공간이 부족해 사회적 고립 예방 거점이 필요합니다.",
    },
    {
        "group": "senior",
        "name": "어르신 맞춤형 돌봄·데이케어 거점",
        "category": "welfare",
        "matchKeywords": ("노인", "돌봄", "어르신", "복지관", "병원"),
        "delivery": "기존 사회복지관·주민센터 연계 소규모 주간보호 및 안심동행 거점 확충",
        "reasonTemplate": "{dong}은 고령층({ratio}%)과 취약계층({vuln}%)이 밀집해 있어 도보권 내 돌봄·의료 연계 거점이 시급합니다.",
    },
    # --- 청년·1인가구 필수 인프라 ---
    {
        "group": "youth",
        "name": "청년 생활문화·악기·동아리 무료 공유공간",
        "category": "culture",
        "matchKeywords": ("악기", "기타", "밴드", "연습실", "청년", "문화"),
        "delivery": "공공청사 야간·주말 유휴 회의실을 공유누리 청년 문화 연습실로 개방",
        "reasonTemplate": "{dong}은 청년 인구 비율이 {ratio}%({count:,}명)로 높으나, 퇴근·주말에 무료로 이용할 수 있는 생활문화 공간이 부족합니다.",
    },
    {
        "group": "youth",
        "name": "청년 취창업·AI 직무 교육 허브",
        "category": "education",
        "matchKeywords": ("취업", "코딩", "AI", "자격증", "영어", "청년"),
        "delivery": "인근 공공도서관·청년공간 내 야간·주말 실무 특강 및 스터디룸 상시 개방",
        "reasonTemplate": "{dong} 청년층({count:,}명, {ratio}%)의 구직·역량강화 수요 대비 지역 내 무료 교육 거점이 부족합니다.",
    },
    {
        "group": "youth",
        "name": "1인가구 주거·생활상담 원스톱 센터",
        "category": "welfare",
        "matchKeywords": ("월세", "1인가구", "청년", "수당", "병원"),
        "delivery": "동 행정복지센터 내 청년·1인가구 전담 상담 창구 및 안심동행 연계",
        "reasonTemplate": "{dong}의 높은 청년 비중({ratio}%)에 맞춰 주거비·긴급생활 지원을 한곳에서 안내할 거점이 필요합니다.",
    },
    # --- 취약계층 · 가족 · 아동 인프라 ---
    {
        "group": "vulnerable",
        "name": "취약계층 통합돌봄·긴급복지 원스톱 거점",
        "category": "welfare",
        "matchKeywords": ("돌봄", "저소득", "긴급", "바우처", "복지관"),
        "delivery": "주민센터·지역 복지관 합동 찾아가는 사각지대 발굴 및 원스톱 상담 운영",
        "reasonTemplate": "{dong}의 취약계층 비율이 {vuln}%로 높아, 복지 사각지대를 선제적으로 발굴할 현장 거점이 시급합니다.",
    },
    {
        "group": "family",
        "name": "방과후 아동돌봄·어린이 복합 도서관",
        "category": "culture",
        "matchKeywords": ("어린이", "아동", "도서관", "육아", "가족", "다문화"),
        "delivery": "작은도서관·학교 유휴 교실을 활용한 주말 가족 독서·돌봄 복합공간 조성",
        "reasonTemplate": "{dong} 생활권 내 가족·아동이 함께 이용할 수 있는 공공 문화·돌봄 시설을 보강할 필요가 있습니다.",
    },
]


def serialize_program(doc: dict) -> ProgramOut:
    data = dict(doc)
    data["id"] = str(data.pop("_id"))
    data.setdefault("location", None)
    return ProgramOut.model_validate(data)


def _recommend_needed_facilities(
    region: RegionStatOut,
    dong_programs: list[ProgramOut],
) -> list[RecommendedFacility]:
    """행정동 인구 분포(고령층·청년·취약계층)와 동 내 실제 보유 시설을 대조해 필요 시설을 추천합니다."""
    total_pop = max(region.population.total, 1)
    senior_ratio = round((region.population.senior / total_pop) * 100, 1)
    youth_ratio = round((region.population.youth / total_pop) * 100, 1)
    vuln_ratio = round(region.population.vulnerableRatio * 100, 1)
    shortages = set(region.scores.shortageCategories)

    scored_candidates: list[tuple[float, RecommendedFacility]] = []

    for bp in FACILITY_BLUEPRINTS:
        group = bp["group"]
        cat: CategoryType = bp["category"]
        keywords: tuple[str, ...] = bp["matchKeywords"]

        # 현재 이 행정동(admCd) 내에 동일 유형 시설이 몇 곳 있는지 실제 DB와 대조
        in_dong_matches = [
            p
            for p in dong_programs
            if p.category == cat
            and any(kw in f"{p.title} {p.summary} {' '.join(p.tags)}" for kw in keywords)
        ]
        current_count = len(in_dong_matches)

        # 인구 군별 적합 점수 산출
        group_weight = 0.0
        target_demo = ""
        ratio_val = 0.0
        count_val = 0

        if group == "senior":
            if senior_ratio < 14.0:
                continue
            group_weight = senior_ratio * 2.4
            ratio_val = senior_ratio
            count_val = region.population.senior
            target_demo = f"어르신(65세+) {count_val:,}명 ({senior_ratio}%)"
        elif group == "youth":
            if youth_ratio < 24.0:
                continue
            group_weight = youth_ratio * 1.4
            ratio_val = youth_ratio
            count_val = region.population.youth
            target_demo = f"청년 인구 {count_val:,}명 ({youth_ratio}%)"
        elif group == "vulnerable":
            if vuln_ratio < 14.0:
                continue
            group_weight = vuln_ratio * 2.5
            ratio_val = vuln_ratio
            count_val = int(total_pop * region.population.vulnerableRatio)
            target_demo = f"취약계층 약 {count_val:,}명 ({vuln_ratio}%)"
        else:
            group_weight = 22.0
            ratio_val = round(100.0 - senior_ratio - youth_ratio, 1)
            count_val = max(0, total_pop - region.population.senior - region.population.youth)
            target_demo = f"가족·일반 주민 {count_val:,}명"

        # 현재 동 내 미보유(0곳)일수록, 그리고 해당 분야가 부족(shortage)일수록 최우선!
        missing_bonus = 35.0 if current_count == 0 else -15.0 * current_count
        shortage_bonus = 22.0 if cat in shortages else 0.0
        gap_bonus = max(0.0, region.scores.gapIndex) * 0.4
        score = group_weight + missing_bonus + shortage_bonus + gap_bonus

        if current_count == 0 and (cat in shortages or region.scores.gapIndex >= 25):
            priority = "urgent"
        elif current_count == 0 or cat in shortages:
            priority = "high"
        else:
            priority = "recommended"

        current_status = (
            f"{region.dong} 내 미보유 (0곳)"
            if current_count == 0
            else f"{region.dong} 내 {current_count}곳 운영 중 (추가 확충 권장)"
        )
        rationale = bp["reasonTemplate"].format(
            dong=region.dong,
            ratio=ratio_val,
            count=count_val,
            vuln=vuln_ratio,
        )
        gap_reduction = 5.8 if cat in shortages else 3.4

        scored_candidates.append(
            (
                score,
                RecommendedFacility(
                    name=bp["name"],
                    category=cat,
                    priority=priority,
                    targetDemographic=target_demo,
                    currentInDongCount=current_count,
                    currentStatus=current_status,
                    rationale=rationale,
                    deliverySuggestion=bp["delivery"],
                    estimatedGapReduction=gap_reduction,
                ),
            )
        )

    scored_candidates.sort(key=lambda pair: pair[0], reverse=True)
    # 분야 다양성을 고려해 상위 4개 반환 (현재 미보유 항목 우선)
    return [item for _, item in scored_candidates[:4]]


async def build_region_report(db: AsyncDatabase, adm_cd: str) -> RegionReportOut | None:
    region_doc = await db["region_stats"].find_one({"admCd": adm_cd})
    if not region_doc:
        return None
    region_doc.pop("_id", None)
    region = RegionStatOut.model_validate(region_doc)

    # 1) 해당 행정동(admCd)에 실제 등록된 프로그램 조회 (미보유 시설 판정용)
    dong_programs = [
        serialize_program(doc)
        async for doc in db["programs"].find({"region.admCd": adm_cd})
    ]

    # 2) MongoDB Aggregation으로 해당 시군구·행정동 실시간 프로그램 공급 수 집계
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

    # 3) 최근 비식별 탐색 수요 신호 집계
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

    # 4) 해당 행정동 중심 좌표 기준 인근 자원 ($geoNear) 최대 6건 조회
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

    # 5) 인구 분포 × 현재 미보유 시설 분석 기반 필요 공공시설 추천
    recommended_facilities = _recommend_needed_facilities(region, dong_programs)

    # 6) 정책·현장 상담 인사이트 생성
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
        recommendedFacilities=recommended_facilities,
        insights=insights,
    )
