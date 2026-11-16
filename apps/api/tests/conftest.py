from datetime import datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import text

from app.db import SessionLocal

KST = ZoneInfo("Asia/Seoul")


@pytest.fixture
def seeded_programs():
    now = datetime.now(KST)
    ids = {
        "today_id": uuid4().hex,
        "expired_id": uuid4().hex,
        "always_id": uuid4().hex,
        "stale_id": uuid4().hex,
    }
    specs = [
        ("today_id", "오늘마감", now.replace(hour=23, minute=59, second=59, microsecond=0), 0),
        ("expired_id", "어제마감", (now - timedelta(days=1)).replace(hour=23, minute=59, second=59, microsecond=0), 0),
        ("always_id", "상시모집", None, 0),
        ("stale_id", "오래된정보", None, 91),
    ]
    with SessionLocal() as s:
        for key, title, apply_end, age_days in specs:
            resource_id = uuid4().hex
            s.execute(text(
                "INSERT INTO resource (id, kind, name, category, adm_cd, source_dataset, "
                "source_id, valid_from, updated_at, precision) VALUES (:id, 'facility', "
                "'테스트기관', 'care', '2711053000', 'test', :id, :vf, :ua, 'exact')"
            ), {"id": resource_id, "vf": now.date(), "ua": now - timedelta(days=age_days)})
            s.execute(text(
                "INSERT INTO offering (id, resource_id, title, fee, currency, apply_end, "
                "status, source_dataset, source_id, days_of_week) VALUES (:id, :rid, :title, "
                "0, 'KRW', :ae, 'open', 'test', :id, '[]'::jsonb)"
            ), {"id": ids[key], "rid": resource_id, "title": title, "ae": apply_end})
        s.commit()
    try:
        yield ids
    finally:
        with SessionLocal() as s:
            s.execute(text("DELETE FROM offering WHERE source_dataset = 'test'"))
            s.execute(text("DELETE FROM resource WHERE source_dataset = 'test'"))
            s.commit()
