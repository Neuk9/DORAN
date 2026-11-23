from app.models.schemas import EligibilityEvaluation, ProgramOut, UserProfile

TIME_LABELS = {
    "weekend": "주말 이용 가능",
    "weekday_evening": "평일 야간 이용 가능",
    "weekday_day": "평일 주간 운영",
    "online": "온라인 신청·이용 가능",
}


def build_explanation(
    program: ProgramOut,
    profile: UserProfile,
    evaluation: EligibilityEvaluation,
) -> str:
    """근거 기반 추천 사유를 생성합니다 (출처 및 확인 필요 사항 포함)."""
    reasons: list[str] = []

    if evaluation.matchedConditions:
        reasons.append(", ".join(evaluation.matchedConditions[:3]) + " 조건에 부합합니다.")

    if program.cost.type == "free":
        reasons.append(f"비용 부담이 없습니다({program.cost.description}).")
    elif program.cost.type == "subsidy":
        reasons.append(f"경제적 지원 혜택({program.cost.description})을 받을 수 있습니다.")

    if profile.timePreferences:
        matched_slots = [TIME_LABELS[s] for s in profile.timePreferences if s in program.schedule.timeSlots]
        if matched_slots:
            reasons.append(f"희망 시간대와 맞습니다({', '.join(matched_slots)}).")

    if program.distanceKm is not None:
        reasons.append(f"기준 위치에서 약 {program.distanceKm}km 거리에 있습니다.")

    if evaluation.status == "verify_needed" and evaluation.verificationNeeded:
        reasons.append(f"신청 전 확인 필요: {evaluation.verificationNeeded[0]}.")

    synced_date = program.source.syncedAt.strftime("%Y-%m-%d")
    reasons.append(f"(출처: {program.source.name}, 기준일 {synced_date})")
    return " ".join(reasons)
