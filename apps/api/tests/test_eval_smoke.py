def test_golden_set_has_fifty_cases():
    import json
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[3]
    lines = (root / "eval" / "golden_set.jsonl").read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 50
    for line in lines:
        row = json.loads(line)
        assert {"id", "persona", "message", "expect_categories"} <= row.keys()
