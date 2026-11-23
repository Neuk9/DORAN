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
        parts.append(f"월 최대 {monthly_total // 10_000:,}만원 지원 가능")
    if annual_total > 0:
        parts.append(f"연 최대 {annual_total // 10_000:,}만원 바우처·환급")
    if free_count > 0:
        parts.append(f"무료 시설·강좌 {free_count}곳")

    headline = (
        " · ".join(parts)
        if parts
        else f"신청 가능한 공공자원 {len(recommendations)}건을 찾았습니다"
    )
    return BenefitSummary(
        estimatedMonthlyKRW=monthly_total,
        estimatedAnnualKRW=annual_total,
        freeResourceCount=free_count,
        subsidyCount=subsidy_count,
        headline=headline,
    )


def find_hidden_gems(
    recommendations: list[RecommendedProgram],
    profile: UserProfile,
) -> list[HiddenGem]:
    """사용자가 직접 언급하지 않았지만 자격 조건에 부합하는 '놓치기 쉬운 숨은 혜택'을 발굴합니다."""
    gems: list[HiddenGem] = []
    kw_set = {k.lower() for k in profile.keywords}
    cat_set = set(profile.categories)

    for rec in recommendations:
        prog = rec.program
        haystack = f"{prog.title} {prog.summary} {' '.join(prog.tags)}".lower()
        keyword_mentioned = any(kw in haystack for kw in kw_set) if kw_set else False
        category_mentioned = prog.category in cat_set if cat_set else False

        # 직접 언급한 키워드가 없거나 다른 분야의 연계 혜택인 경우 선제 발굴
        if not keyword_mentioned or (cat_set and not category_mentioned):
            reason = (
                f"직접 물어보지 않으셨지만, {rec.eligibility.matchedConditions[0]} 조건으로 함께 챙길 수 있는 혜택이에요."
                if rec.eligibility.matchedConditions
                else "현재 생활 조건과 연계해 추가로 신청할 수 있는 숨은 공공자원이에요."
            )
            gems.append(HiddenGem(program=prog, reason=reason))
        if len(gems) >= 3:
            break

    return gems


def build_action_plan_and_docs(
    recommendations: list[RecommendedProgram],
) -> tuple[list[ActionPlanStep], list[str]]:
    """추천 결과를 실행 순서(온라인 신청 → 현장 이용 → 서류 확인)와 중복 제거 통합 서류로 묶습니다."""
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
                phase="1단계 · 오늘 온라인 신청",
                title=f"지원금·온라인 혜택 {len(online_subsidies)}건 먼저 접수",
                description=f"{names} 등은 예산·기간 마감이 있으므로 온라인으로 우선 신청해 두는 것이 유리합니다.",
                programIds=[p.id for p in online_subsidies[:3]],
            )
        )
    if offline_visits:
        names = ", ".join(p.title for p in offline_visits[:2])
        steps.append(
            ActionPlanStep(
                phase="2단계 · 생활권 방문·예약",
                title=f"가까운 무료 시설·강좌 {len(offline_visits)}곳 이용",
                description=f"{names} 등 이동 가능한 인근 시설을 사전 예약해 바로 이용해 보세요.",
                programIds=[p.id for p in offline_visits[:3]],
            )
        )
    if verify_items or all_docs:
        doc_preview = ", ".join(all_docs[:4]) if all_docs else "신분증"
        steps.append(
            ActionPlanStep(
                phase="3단계 · 통합 서류 한 번에 준비",
                title=f"공통 구비서류 {len(all_docs)}종으로 중복 준비 줄이기",
                description=f"{doc_preview} 등을 한 번에 발급받으면 여러 지원사업을 동시에 신청할 수 있습니다.",
                programIds=[p.id for p in verify_items[:3]],
            )
        )

    return steps, all_docs
