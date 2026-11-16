from etl.collectors.culture import CultureEduCollector, CultureFacilityCollector


def test_culture_facility_category():
    rows = [{"fcltNm": "수성문화재단", "adres": "대구 수성구", "fcltSe": "생활문화센터"}]
    recs = CultureFacilityCollector.normalize_rows(rows)
    assert recs[0].category == "culture"
    assert recs[0].kind == "facility"


def test_culture_edu_program_is_offering():
    rows = [{"단체명": "예술교육센터", "프로그램명": "어린이 미술", "교육시작일": "2026-11-20",
             "교육종료일": "2026-12-20", "신청시작일": "2026-11-01", "신청종료일": "2026-11-18"}]
    recs = CultureEduCollector.normalize_rows(rows)
    assert recs[0].title == "어린이 미술"
    assert recs[0].apply_end.isoformat() == "2026-11-18T23:59:59+09:00"
