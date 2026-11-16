from datetime import date
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from app.main import create_app
from app.timeutil import end_of_day_kst


def test_end_of_day_is_2359_kst():
    dt = end_of_day_kst(date(2026, 11, 20))
    assert dt.hour == 23 and dt.minute == 59 and dt.second == 59
    assert dt.tzinfo == ZoneInfo("Asia/Seoul")


def test_program_expiring_today_is_listed(seeded_programs):
    client = TestClient(create_app())
    res = client.get("/api/programs", params={"deadline_within_days": 0})
    ids = [p["offering_id"] for p in res.json()["data"]]
    assert seeded_programs["today_id"] in ids


def test_program_expired_yesterday_is_hidden(seeded_programs):
    client = TestClient(create_app())
    res = client.get("/api/programs", params={"size": 50})
    ids = [p["offering_id"] for p in res.json()["data"]]
    assert seeded_programs["expired_id"] not in ids


def test_stale_program_flags_refresh_needed(seeded_programs):
    client = TestClient(create_app())
    res = client.get(f"/api/programs/{seeded_programs['stale_id']}")
    assert res.json()["data"]["stale"] is True
