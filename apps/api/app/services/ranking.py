import math

from app.models.schemas import (
    EligibilityEvaluation,
    ProgramOut,
    ScoreBreakdown,
    UserProfile,
)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def score_program(
    program: ProgramOut,
    profile: UserProfile,
    evaluation: EligibilityEvaluation,
    user_coords: tuple[float, float] | None = None,
) -> ScoreBreakdown:
    """다차원 스코어링 (자격 45% + 거리 20% + 비용 15% + 시간/관심도 20%)."""
    # 1) 자격 점수 (0~100)
    if evaluation.status == "eligible":
        elig_score = 100.0
    elif evaluation.status == "verify_needed":
        elig_score = 78.0 + min(len(evaluation.matchedConditions) * 4.0, 14.0)
    else:
        elig_score = 15.0

    # 2) 거리 점수 (0~100) — 좌표 없는 온라인/전국 프로그램은 중립(75점) 부여
    if program.location is None:
        dist_score = 75.0
    elif user_coords is not None:
        p_lng, p_lat = program.location.coordinates
        dist_km = haversine_km(user_coords[0], user_coords[1], p_lat, p_lng)
        program.distanceKm = dist_km
        dist_score = max(15.0, round(100.0 - dist_km * 12.0, 1))
    else:
        if profile.dong and program.region.dong == profile.dong:
            dist_score = 95.0
        elif profile.sigungu and program.region.sigungu == profile.sigungu:
            dist_score = 85.0
        elif program.region.isNationwide:
            dist_score = 75.0
        else:
            dist_score = 55.0

    # 3) 비용 점수 (0~100)
    if program.cost.type in ("free", "subsidy"):
        cost_score = 100.0
    elif profile.preferFree:
        cost_score = 35.0
    else:
        cost_score = 70.0

    # 4) 시간 및 관심 키워드/분야 연관성 (0~100)
    rel_score = 45.0
    if profile.categories:
        if program.category in profile.categories:
            rel_score += 25.0
    else:
        rel_score += 15.0

    if profile.timePreferences:
        slot_overlap = set(profile.timePreferences) & set(program.schedule.timeSlots)
        if slot_overlap:
            rel_score += 20.0
    else:
        rel_score += 10.0

    if profile.keywords:
        haystack = f"{program.title} {program.summary} {' '.join(program.tags)}".lower()
        hits = sum(1 for kw in profile.keywords if kw.lower() in haystack)
        rel_score += min(hits * 15.0, 35.0)

    rel_score = min(100.0, rel_score)

    total = round(
        elig_score * 0.45 + dist_score * 0.20 + cost_score * 0.15 + rel_score * 0.20,
        1,
    )
    return ScoreBreakdown(
        total=total,
        eligibility=round(elig_score, 1),
        distance=round(dist_score, 1),
        cost=round(cost_score, 1),
        scheduleAndRelevance=round(rel_score, 1),
    )
