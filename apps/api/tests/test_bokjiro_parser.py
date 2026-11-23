from app.ingest.sync_public import extract_bokjiro_detail_fields


def test_extract_bokjiro_detail_central_youth_account() -> None:
    parsed = extract_bokjiro_detail_fields(
        target_text="가입연령 : 신청 당시 만 15세~ 39세 근로·사업소득 발생, 소득인정액 기준 중위소득 50% 이하",
        criteria_text="지원대상의 내용을 참고해주시기 바랍니다.",
        service_text="중위소득 50%초과~100%이하 : 10만원 정액 매칭 / 중위소득 50%이하 : 30만원 정액 매칭",
        apply_text="거주지 읍/면/동 주민센터 또는 복지로 웹사이트에서 신청서, 신분증, 소득 증빙서류 제출",
    )
    assert parsed["minAge"] == 15
    assert parsed["maxAge"] == 39
    assert parsed["incomeMaxPct"] == 50
    assert parsed["amount"] == 300_000
    assert "신청서" in parsed["requiredDocs"]
    assert "신분증" in parsed["requiredDocs"]
    assert "소득·재산 증빙서류" in parsed["requiredDocs"]


def test_extract_bokjiro_detail_local_senior_grant() -> None:
    parsed = extract_bokjiro_detail_fields(
        target_text="○ 지원대상 - 구로구에 1년 이상 연속 거주하는 100세 이상 어르신",
        criteria_text="",
        service_text="○ 지원금액 : 생애 1회 100만원 계좌입금 (100세가 되는 해)",
        apply_text="신청서, 신분증, 통장사본, 대리인 신청시 위임장 제출",
    )
    assert parsed["minAge"] == 100
    assert parsed["maxAge"] is None
    assert parsed["amount"] == 1_000_000
    assert "통장사본" in parsed["requiredDocs"]
    assert "위임장(대리 신청 시)" in parsed["requiredDocs"]
