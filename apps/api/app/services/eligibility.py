from datetime import datetime, timedelta, timezone

from app.models.schemas import EligibilityEvaluation, ProgramOut, UserProfile

KST = timezone(timedelta(hours=9))

GROUP_LABELS = {
    "youth": "청년",
    "student": "대학생·학생",
    "senior": "어르신(고령층)",
    "low_income": "저소득·취약계층",
    "family": "가족·아동·다문화",
    "job_seeker": "취업준비생·미취업자",
    "general": "일반 주민",
}


def is_program_open(program: ProgramOut, now: datetime | None = None) -> bool:
    """마감일 경계(KST 23:59:59) 기준으로 신청 가능 여부를 판정합니다."""
    if program.isAlwaysOpen or program.deadline is None:
        return True
    current = now.astimezone(KST) if now else datetime.now(KST)
    deadline = program.deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=KST)
    else:
        deadline = deadline.astimezone(KST)
    return current <= deadline


def evaluate_eligibility(
    program: ProgramOut,
    profile: UserProfile,
    now: datetime | None = None,
) -> EligibilityEvaluation:
    """결정론적 자격요건 판정 엔진.

    LLM 환각을 배제하고 규칙 기반으로 신청 가능 / 별도 확인 필요 / 불가 상태를 판정합니다.
    """
    matched: list[str] = []
    verify_needed: list[str] = list(program.eligibility.requiresVerification)
    unmet: list[str] = []

    # 1) 마감일 판정
    if not is_program_open(program, now=now):
        unmet.append("모집 기간이 마감된 사업입니다.")
    else:
        matched.append("현재 신청 가능 기간")

    # 2) 지역 조건 판정
    if program.region.isNationwide:
        matched.append("전국 대상 지원")
    elif profile.sigungu:
        if program.region.sigungu == profile.sigungu:
            matched.append(f"{profile.sigungu} 지역 일치")
        elif profile.sido and program.region.sido == profile.sido:
            matched.append(f"{profile.sido} 인근 지역 자원")
        else:
            unmet.append(f"주 대상 지역({program.region.sido} {program.region.sigungu})과 거주지가 다릅니다.")
    elif profile.sido and program.region.sido == profile.sido:
        matched.append(f"{profile.sido} 지역 일치")

    # 3) 연령 조건 판정
    min_age = program.eligibility.minAge
    max_age = program.eligibility.maxAge
    if min_age is not None or max_age is not None:
        if profile.age is not None:
            too_young = min_age is not None and profile.age < min_age
            too_old = max_age is not None and profile.age > max_age
            if too_young or too_old:
                range_txt = f"만 {min_age or 0}세 ~ {f'{max_age}세' if max_age else '이상'}"
                unmet.append(f"연령 기준({range_txt})에 해당하지 않습니다.")
            else:
                matched.append(f"연령 조건 부합(만 {profile.age}세)")
        else:
            range_txt = f"만 {min_age or 0}세 ~ {f'{max_age}세' if max_age else '이상'}"
            verify_needed.append(f"연령 조건({range_txt}) 확인 필요")

    # 4) 대상 그룹 판정
    prog_groups = set(program.eligibility.targetGroups)
    user_groups = set(profile.targetGroups)
    if prog_groups and "general" not in prog_groups:
        overlap = prog_groups & user_groups
        if overlap:
            labels = ", ".join(GROUP_LABELS.get(g, g) for g in sorted(overlap))
            matched.append(f"대상 유형 일치({labels})")
        elif user_groups:
            # 예: 청년이 어르신 전용 사업을 볼 때
            if "senior" in prog_groups and "youth" in user_groups and "senior" not in user_groups:
                unmet.append("어르신(고령층) 전용 사업입니다.")
            elif "family" in prog_groups and prog_groups == {"family"} and "family" not in user_groups:
                verify_needed.append("가족·아동 대상 요건 확인 필요")
            else:
                verify_needed.append("세부 지원 대상 해당 여부 확인 필요")
        else:
            verify_needed.append("지원 대상 자격 확인 필요")
    elif "general" in prog_groups:
        matched.append("일반 주민 누구나 이용 가능")

    # 5) 소득분위 기준
    if program.eligibility.incomeMaxPct is not None:
        income_note = f"기준중위소득 {program.eligibility.incomeMaxPct}% 이하 확인"
        if not any("중위소득" in v or "소득" in v for v in verify_needed):
            verify_needed.append(income_note)

    # 중복 제거
    verify_needed = list(dict.fromkeys(verify_needed))

    if unmet:
        status = "ineligible"
    elif verify_needed:
        status = "verify_needed"
    else:
        status = "eligible"

    return EligibilityEvaluation(
        status=status,
        matchedConditions=matched,
        verificationNeeded=verify_needed,
        unmetConditions=unmet,
    )
