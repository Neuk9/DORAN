from datetime import UTC, datetime, timedelta, timezone

from app.models.schemas import (
    ApplyInfo,
    EligibilityRule,
    ProgramCost,
    ProgramOut,
    ProgramRegion,
    ProgramSchedule,
    SourceInfo,
    UserProfile,
)
from app.services.eligibility import evaluate_eligibility, is_program_open
from app.services.ranking import score_program
from app.services.safety import detect_crisis, mask_pii

KST = timezone(timedelta(hours=9))


def _sample_program(**overrides) -> ProgramOut:
    base = {
        "id": "507f1f77bcf86cd799439011",
        "externalId": "test:prog-1",
        "category": "welfare",
        "title": "청년 테스트 지원금",
        "summary": "테스트 요약",
        "provider": "구로구청",
        "region": ProgramRegion(
            sido="서울특별시", sigungu="구로구", dong="구로3동", admCd="1153054000", isNationwide=False
        ),
        "location": None,
        "address": "온라인",
        "cost": ProgramCost(type="subsidy", amount=0, description="월 20만원 지원"),
        "schedule": ProgramSchedule(days=["mon"], timeSlots=["online"], hoursText="상시"),
        "deadline": datetime(2026, 12, 31, 23, 59, 59, tzinfo=KST),
        "isAlwaysOpen": False,
        "eligibility": EligibilityRule(
            minAge=19,
            maxAge=34,
            targetGroups=["youth", "student"],
            incomeMaxPct=150,
            requiresVerification=["소득분위 확인"],
            requiredDocs=["신분증"],
        ),
        "applyInfo": ApplyInfo(method="온라인", url="https://example.com", phone="02-120"),
        "source": SourceInfo(name="복지로", syncedAt=datetime(2026, 11, 20, tzinfo=UTC)),
        "tags": ["청년", "지원금"],
    }
    base.update(overrides)
    return ProgramOut(**base)


def test_detect_crisis_triggers_immediately() -> None:
    res = detect_crisis("집에 단전되고 너무 힘들어서 죽고 싶어요")
    assert res is not None
    assert res.detected is True
    numbers = {c.number for c in res.contacts}
    assert {"112", "119", "129", "1366"}.issubset(numbers)


def test_detect_crisis_normal_query_returns_none() -> None:
    assert detect_crisis("구로구 20대 대학생 주말 무료 악기 강좌 알려주세요") is None


def test_mask_pii_scrubs_sensitive_tokens() -> None:
    raw = "제 번호는 010-1234-5678이고 주민번호 990101-1234567, 이메일 user@test.kr 입니다."
    masked = mask_pii(raw)
    assert "010-1234-5678" not in masked
    assert "990101-1234567" not in masked
    assert "user@test.kr" not in masked
    assert "[전화번호 보호]" in masked
    assert "[주민번호 보호]" in masked
    assert "[이메일 보호]" in masked


def test_deadline_boundary_kst_235959() -> None:
    prog = _sample_program(deadline=datetime(2026, 11, 23, 23, 59, 59, tzinfo=KST))
    same_day_last_sec = datetime(2026, 11, 23, 23, 59, 59, tzinfo=KST)
    next_day_first_sec = datetime(2026, 11, 24, 0, 0, 0, tzinfo=KST)
    assert is_program_open(prog, now=same_day_last_sec) is True
    assert is_program_open(prog, now=next_day_first_sec) is False


def test_eligibility_deterministic_states() -> None:
    prog = _sample_program()
    youth_profile = UserProfile(
        sido="서울특별시", sigungu="구로구", age=24, targetGroups=["youth", "student"]
    )
    eval_verify = evaluate_eligibility(prog, youth_profile, now=datetime(2026, 11, 23, tzinfo=KST))
    assert eval_verify.status == "verify_needed"
    assert any("소득" in v for v in eval_verify.verificationNeeded)

    senior_profile = UserProfile(sido="서울특별시", sigungu="구로구", age=70, targetGroups=["senior"])
    eval_ineligible = evaluate_eligibility(prog, senior_profile, now=datetime(2026, 11, 23, tzinfo=KST))
    assert eval_ineligible.status == "ineligible"

    open_culture = _sample_program(
        category="culture",
        eligibility=EligibilityRule(minAge=19, maxAge=34, targetGroups=["youth"]),
    )
    eval_ok = evaluate_eligibility(open_culture, youth_profile, now=datetime(2026, 11, 23, tzinfo=KST))
    assert eval_ok.status == "eligible"


def test_ranking_handles_missing_location_neutrally() -> None:
    prog = _sample_program(location=None)
    profile = UserProfile(sido="서울특별시", sigungu="구로구", age=24, targetGroups=["youth"])
    ev = evaluate_eligibility(prog, profile, now=datetime(2026, 11, 23, tzinfo=KST))
    scores = score_program(prog, profile, ev, user_coords=(37.4852, 126.8965))
    assert scores.distance == 75.0
    assert scores.total > 70.0
