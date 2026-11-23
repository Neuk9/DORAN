import math
import re

from app.models.schemas import (
    EligibilityEvaluation,
    ProgramOut,
    ScoreBreakdown,
    UserProfile,
)

SYNONYMS: dict[str, list[str]] = {
    "악기": ["기타", "통기타", "우쿨렐레", "피아노", "밴드", "연습실", "음악"],
    "지원금": ["수당", "월세", "장학금", "응시료", "바우처", "연금", "지원"],
    "돈": ["지원금", "수당", "월세", "바우처", "장학금"],
    "어르신": ["노인", "고령", "시니어", "연금", "돌봄"],
    "노인": ["어르신", "고령", "시니어", "연금", "돌봄"],
    "난방": ["난방비", "에너지", "바우처", "전기"],
    "아이": ["아동", "어린이", "육아", "돌봄", "가족"],
    "취업": ["구직", "자격증", "코딩", "어학", "부트캠프"],
    "스마트폰": ["키오스크", "디지털", "휴대폰"],
}

STOPWORDS = {"무료", "주말", "평일", "야간", "강좌", "프로그램", "지원", "서비스", "교육", "문화", "복지"}


def _expand_tokens(keywords: list[str]) -> tuple[set[str], set[str]]:
    """띄어쓰기 구문 키워드를 핵심 단어 토큰과 동의어로 분리·확장합니다."""
    core_tokens: set[str] = set()
    expanded_tokens: set[str] = set()
    for kw in keywords:
        parts = [p.strip().lower() for p in re.split(r"[\s,/·]+", kw) if len(p.strip()) >= 2]
        for part in parts:
            if part not in STOPWORDS:
                core_tokens.add(part)
            expanded_tokens.add(part)
            for key, syns in SYNONYMS.items():
                if key in part:
                    expanded_tokens.update(syns)
    return core_tokens, expanded_tokens


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
    """다차원 스코어링 (의도·키워드·시간 45% + 자격 30% + 거리 15% + 비용 10%)."""
    # 1) 자격 점수 (0~100) — 소득 확인이 필요한 복지 제도가 과도하게 불이익 받지 않도록 균형 조정
    if evaluation.status == "eligible":
        elig_score = 100.0
    elif evaluation.status == "verify_needed":
        has_group_match = any("대상 유형 일치" in m for m in evaluation.matchedConditions)
        elig_score = 92.0 if has_group_match else 76.0
    else:
        elig_score = 10.0

    # 2) 거리 점수 (0~100) — 좌표 없는 온라인/전국 프로그램은 중립(75점)
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
            dist_score = 88.0
        elif program.region.isNationwide:
            dist_score = 75.0
        else:
            dist_score = 55.0

    # 3) 비용 점수 (0~100)
    if program.cost.type in ("free", "subsidy"):
        cost_score = 100.0
    elif profile.preferFree:
        cost_score = 30.0
    else:
        cost_score = 70.0

    # 4) 질문 의도 · 키워드 · 대상 · 시간 연관성 (0~100)
    rel_score = 20.0

    if profile.categories:
        if program.category in profile.categories:
            rel_score += 18.0
    else:
        rel_score += 10.0

    if profile.timePreferences:
        slot_overlap = set(profile.timePreferences) & set(program.schedule.timeSlots)
        if slot_overlap:
            rel_score += 18.0
        elif "online" in program.schedule.timeSlots and program.cost.type == "subsidy":
            # 지원금 제도는 주말/야간과 무관하게 온라인 신청 가능
            rel_score += 12.0
    else:
        rel_score += 8.0

    core_tokens, expanded_tokens = _expand_tokens(profile.keywords)
    if core_tokens or expanded_tokens:
        title_tags = f"{program.title} {' '.join(program.tags)}".lower()
        full_text = f"{title_tags} {program.summary}".lower()

        core_hits = sum(1 for tok in core_tokens if tok in title_tags)
        syn_hits = sum(1 for tok in expanded_tokens if tok in full_text)

        if core_hits > 0:
            rel_score += min(core_hits * 22.0, 44.0)
        elif syn_hits > 0:
            rel_score += min(syn_hits * 14.0, 32.0)
        else:
            # 사용자가 구체적 키워드를 말했는데 전혀 안 맞으면 명확히 후순위로
            rel_score -= 12.0
    else:
        rel_score += 20.0

    # 지원금 언급 시 subsidy 타입 가산
    if any(w in " ".join(profile.keywords) for w in ("지원금", "수당", "월세", "장학금", "바우처")):
        if program.cost.type == "subsidy":
            rel_score += 16.0

    rel_score = max(0.0, min(100.0, rel_score))

    total = round(
        rel_score * 0.45 + elig_score * 0.30 + dist_score * 0.15 + cost_score * 0.10,
        1,
    )
    return ScoreBreakdown(
        total=total,
        eligibility=round(elig_score, 1),
        distance=round(dist_score, 1),
        cost=round(cost_score, 1),
        scheduleAndRelevance=round(rel_score, 1),
    )
