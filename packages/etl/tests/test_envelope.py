from etl.collectors.education import ShareNuriCollector


def test_real_envelope_is_unwrapped():
    envelope = {
        "response": {
            "body": {"items": {"item": [{"강좌명": "어린이 코딩", "대상": "초등 1~3학년", "수강료": "무료"}]}}
        }
    }
    rows = ShareNuriCollector.extract_rows(envelope)
    assert rows[0]["강좌명"] == "어린이 코딩"
    assert len(ShareNuriCollector.normalize_rows(rows)) == 1
