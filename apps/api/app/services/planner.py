import re

from app.models.schemas import (
    ActionPlanStep,
    BenefitSummary,
    HiddenGem,
    RecommendedProgram,
    UserProfile,
)

MONTHLY_PATTERN = re.compile(r"월\s*(?:최대\s*)?(\d{1,3})\s*만\s*원")
ANNUAL_PATTERN = re.compile(r"연\s*(?:최대\s*)?(\d{1,3})\s*만\s*원")


def build_benefit_summary(recommendations: list[RecommendedProgram]) -> BenefitSummary:
    """추천된 공공자원들의 예상 금전 혜택(월/연)과 무료 자원 수를 결정론적으로 합산합니다."""
    monthly_total = 0
    annual_total = 0
    free_count = 0
    subsidy_count = 0

    for rec in recommendations:
        prog = rec.program
        desc = prog.cost.description
        if prog.cost.type == "free":
            free_count += 1
        elif prog.cost.type == "subsidy":
            subsidy_count += 1
            m_match = MONTHLY_PATTERN.search(desc)
            if m_match:
                monthly_total += int(m_match.group(1)) * 10_000
            a_match = ANNUAL_PATTERN.search(desc)
            if a_match:
                annual_total += int(a_match.group(1)) * 10_000

    parts: list[str] = []
    if monthly_total > 0:
        parts.append(f"월 최대 {monthly_total // 10_000:,}만원")
    if annual_total > 0:
        parts.append(f"연 최대 {annual_total // 10_000:,}만원")
    if free_count > 0:
        parts.append(f"무료 이용 {free_count}곳")

    headline = (
        " · ".join(parts)
        if parts
        else f"신청 가능한 공공자원 {len(recommendations)}건"
    )
    return BenefitSummary(
        estimatedMonthlyKRW=monthly_total,
        estimatedAnnualKRW=annual_total,
        freeResourceCount=free_count,
        subsidyCount=subsidy_count,
        headline=headline,
    )


def find_hidden_gems(
    all_scored: list[RecommendedProgram],
    profile: UserProfile,
) -> list[HiddenGem]:
    """메인 상위 3건과 겹치지 않으면서, 사용자가 직접 언급하지 않은 연계 혜택을 선별합니다."""
    top_ids = {r.program.id for r in all_scored[:3]}
    kw_set = {k.lower() for k in profile.keywords}
    cat_set = set(profile.categories)

    candidates = [r for r in all_scored if r.program.id not in top_ids]
    gems: list[HiddenGem] = []

    for rec in candidates:
        prog = rec.program
        haystack = f"{prog.title} {prog.summary} {' '.join(prog.tags)}".lower()
        keyword_hits = sum(1 for kw in kw_set if kw in haystack)
        other_category = bool(cat_set) and prog.category not in cat_set

        if keyword_hits == 0 or other_category:
            meaningful = [
                c
                for c in rec.eligibility.matchedConditions
                if c not in ("현재 신청 가능 기간", "일반 주민 누구나 이용 가능")
            ]
            basis = meaningful[0] if meaningful else "현재 조건 기준"
            if prog.cost.type == "subsidy":
                reason = f"{prog.cost.description} · {basis} 조건으로 함께 신청할 수 있는 지원 제도입니다."
            elif prog.region.isNationwide:
                reason = f"{prog.schedule.hoursText} · {prog.cost.description} — 지역 제한 없이 바로 이용할 수 있습니다."
            else:
                reason = f"{prog.schedule.hoursText} · {prog.cost.description} — {basis}으로 인근에서 이용 가능합니다."
            gems.append(HiddenGem(program=prog, reason=reason))

        if len(gems) >= 3:
            break

    return gems


def build_action_plan_and_docs(
    recommendations: list[RecommendedProgram],
) -> tuple[list[ActionPlanStep], list[str]]:
    """추천 결과를 실행 순서와 중복 제거 통합 서류로 정리합니다."""
    online_subsidies = [
        r.program
        for r in recommendations
        if r.program.cost.type == "subsidy" or "online" in r.program.schedule.timeSlots
    ]
    offline_visits = [
        r.program
        for r in recommendations
        if r.program.location is not None and r.program.cost.type != "subsidy"
    ]
    verify_items = [r.program for r in recommendations if r.eligibility.status == "verify_needed"]

    all_docs: list[str] = []
    for rec in recommendations:
        for doc in rec.program.eligibility.requiredDocs:
            if doc and doc not in all_docs:
                all_docs.append(doc)

    steps: list[ActionPlanStep] = []
    if online_subsidies:
        names = ", ".join(p.title for p in online_subsidies[:2])
        steps.append(
            ActionPlanStep(
                phase="1단계",
                title=f"마감·예산 있는 지원금 {len(online_subsidies)}건 온라인 먼저 접수",
                description=f"{names}부터 신청해 두는 것이 가장 유리합니다.",
                programIds=[p.id for p in online_subsidies[:3]],
            )
        )
    if offline_visits:
        names = ", ".join(p.title for p in offline_visits[:2])
        steps.append(
            ActionPlanStep(
                phase="2단계",
                title=f"가까운 무료 시설·강좌 {len(offline_visits)}곳 예약 및 이용",
                description=f"{names} 등 인근 시설을 원하는 시간대에 예약해 보세요.",
                programIds=[p.id for p in offline_visits[:3]],
            )
        )
    if verify_items or all_docs:
        doc_preview = ", ".join(all_docs[:4]) if all_docs else "신분증"
        steps.append(
            ActionPlanStep(
                phase="3단계",
                title=f"공통 서류 {len(all_docs)}종 한 번에 준비",
                description=f"{doc_preview}을 묶어 준비하면 여러 사업을 중복 없이 신청할 수 있습니다.",
                programIds=[p.id for p in verify_items[:3]],
            )
        )

    return steps, all_docs
