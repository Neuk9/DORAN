from datetime import datetime

from app.schemas import Candidate, ScoredCandidate, SearchCriteria
from app.services.eligibility import evaluate

WEIGHTS = {
    "eligibility": 0.35,
    "proximity": 0.20,
    "time": 0.15,
    "budget": 0.10,
    "freshness": 0.10,
    "urgency": 0.10,
}

STATE_SCORE = {"eligible": 1.0, "likely": 0.6, "needs_check": 0.3, "ineligible": 0.0}


def _freshness(updated_at: datetime, now: datetime) -> float:
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=now.tzinfo)
    age_days = max(0.0, (now - updated_at).total_seconds() / 86400)
    return 0.5 ** (age_days / 30)


def _proximity(distance_km: float | None) -> float:
    if distance_km is None:
        return 0.5
    return max(0.0, 1.0 - distance_km / 10.0)


def _budget(fee: int, budget: int | None) -> float:
    if budget is None or budget <= 0:
        return 1.0 if fee == 0 else 0.6
    if fee <= budget:
        return 1.0
    return max(0.0, 1.0 - (fee - budget) / budget)


def _time_fit(c: Candidate, criteria: SearchCriteria) -> float:
    if not c.days_of_week:
        return 0.6
    window = criteria.time_window or {}
    days = window.get("days") if isinstance(window, dict) else None
    if not days:
        return 0.6
    try:
        wanted = {int(d) for d in days}
    except (TypeError, ValueError):
        return 0.6
    return 1.0 if wanted & set(c.days_of_week) else 0.2


def _urgency(c: Candidate, now: datetime) -> float:
    if c.apply_end is None:
        return 0.5
    if c.apply_end.tzinfo is None:
        c.apply_end = c.apply_end.replace(tzinfo=now.tzinfo)
    days_left = (c.apply_end - now).total_seconds() / 86400
    if days_left <= 0:
        return 0.0
    if days_left <= 3:
        return 1.0
    if days_left <= 14:
        return 0.8
    return 0.5


def _score(c: Candidate, criteria: SearchCriteria, now: datetime) -> ScoredCandidate:
    state = evaluate(c.eligibility, criteria)
    reasons: list[str] = []
    if state == "eligible":
        reasons.append("자격 요건 충족")
    elif state == "needs_check":
        reasons.append("자격 확인 필요")

    if c.distance_km is None:
        reasons.append("거리 정보 없음")
    elif c.distance_km <= 2:
        reasons.append("가까운 거리")

    if c.fee == 0:
        reasons.append("무료")
    elif criteria.budget_krw is not None and c.fee <= criteria.budget_krw:
        reasons.append("예산 내")

    urg = _urgency(c, now)
    if urg >= 1.0:
        reasons.append("마감 임박")

    if _freshness(c.updated_at, now) > 0.7:
        reasons.append("최근 갱신")

    score = (
        WEIGHTS["eligibility"] * STATE_SCORE[state]
        + WEIGHTS["proximity"] * _proximity(c.distance_km)
        + WEIGHTS["time"] * _time_fit(c, criteria)
        + WEIGHTS["budget"] * _budget(c.fee, criteria.budget_krw)
        + WEIGHTS["freshness"] * _freshness(c.updated_at, now)
        + WEIGHTS["urgency"] * urg
    )
    return ScoredCandidate(
        **c.model_dump(),
        score=round(score, 4),
        reasons=reasons,
        eligibility_state=state,
    )


def rank_candidates(
    candidates: list[Candidate],
    criteria: SearchCriteria,
    *,
    now: datetime,
    limit: int = 5,
    mmr_lambda: float = 0.7,
) -> list[ScoredCandidate]:
    scored: list[ScoredCandidate] = []
    for c in candidates:
        if c.apply_end is not None:
            end = c.apply_end if c.apply_end.tzinfo else c.apply_end.replace(tzinfo=now.tzinfo)
            if end <= now:
                continue
        if criteria.age_years is not None:
            if c.target_age_min is not None and criteria.age_years < c.target_age_min:
                continue
            if c.target_age_max is not None and criteria.age_years > c.target_age_max:
                continue
        result = _score(c, criteria, now)
        if result.eligibility_state == "ineligible":
            continue
        scored.append(result)

    scored.sort(key=lambda x: x.score, reverse=True)

    selected: list[ScoredCandidate] = []
    pool = scored[:]
    while pool and len(selected) < limit:
        best = None
        best_value = float("-inf")
        for cand in pool:
            redundancy = max(
                (1.0 if cand.category == s.category else 0.0) for s in selected
            ) if selected else 0.0
            value = mmr_lambda * cand.score - (1 - mmr_lambda) * redundancy
            if value > best_value:
                best, best_value = cand, value
        selected.append(best)
        pool.remove(best)
    return selected
