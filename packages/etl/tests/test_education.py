import pytest

from etl.collectors.education import KmoocCollector, ShareNuriCollector, parse_fee


@pytest.mark.parametrize("text,expected", [("무료", 0), ("30,000원", 30000), ("", 0)])
def test_parse_fee(text, expected):
    assert parse_fee(text) == expected


def test_sharenuri_maps_target_age():
    rows = [{"강좌명": "어린이 코딩", "대상": "초등 1~3학년", "수강료": "무료",
             "교육시작일": "2026-11-20", "교육종료일": "2026-12-18"}]
    recs = ShareNuriCollector.normalize_rows(rows)
    assert recs[0].title == "어린이 코딩"
    assert (recs[0].target_age_min, recs[0].target_age_max) == (7, 9)
    assert recs[0].fee == 0


def test_kmooc_maps_title_and_org():
    rows = [{"강좌명": "파이썬 입문", "제공기관": "국민대", "수강료": "0"}]
    recs = KmoocCollector.normalize_rows(rows)
    assert recs[0].title == "파이썬 입문"
    assert recs[0].category == "education"
