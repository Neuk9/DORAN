from etl.collectors.ssis_welfare import SsisLocalWelfareCollector


def test_normalizes_required_fields():
    rows = [
        {
            "서비스명": "청년 월세지원",
            "지원대상": "만 19~34세",
            "신청방법": "온라인",
            "서비스URL": "https://example.go.kr/1",
            "소관시군구코드": "27110",
        }
    ]
    records = SsisLocalWelfareCollector.normalize_rows(rows)
    assert len(records) == 1
    r = records[0]
    assert r.kind == "service"
    assert r.category == "care"
    assert r.target_text == "만 19~34세"
    assert r.source_id == "1"


def test_drops_rows_without_name():
    rows = [{"지원대상": "누구나", "서비스URL": "https://example.go.kr/2"}]
    assert SsisLocalWelfareCollector.normalize_rows(rows) == []
