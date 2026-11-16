from etl.collectors.ssis_facilities import SsisFacilityCollector


def test_facility_event_becomes_offering():
    rows = [{"fcltNm": "수성노인복지관", "fcltAddr": "대구 수성구 범어로 1", "fcltCd": "C1",
             "title": "어르신 건강교실", "accpBgnDe": "20261101", "accpClseDe": "20261120"}]
    resources, offerings = SsisFacilityCollector.normalize_rows(rows)
    assert resources[0].kind == "facility"
    assert offerings[0].title == "어르신 건강교실"
    assert offerings[0].apply_end.isoformat() == "2026-11-20T23:59:59+09:00"


def test_facility_without_event_has_no_offering():
    rows = [{"fcltNm": "수성노인복지관", "fcltAddr": "대구 수성구 범어로 1", "fcltCd": "C1"}]
    resources, offerings = SsisFacilityCollector.normalize_rows(rows)
    assert len(resources) == 1
    assert offerings == []
