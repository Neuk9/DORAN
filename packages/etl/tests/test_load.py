import pytest
from sqlalchemy import text

from etl.load import upsert_records
from etl.records import ResourceRecord

pytestmark = pytest.mark.integration


def test_same_name_and_address_keeps_latest(db_session):
    old = ResourceRecord(source_dataset="a", source_id="1", kind="service",
                         name="복지관", address="대구 수성구 1", category="care",
                         updated_at="2026-11-01T00:00:00+09:00")
    new = ResourceRecord(source_dataset="b", source_id="2", kind="service",
                         name="복지관", address="대구 수성구 1", category="care",
                         updated_at="2026-11-17T00:00:00+09:00")
    upsert_records(db_session, [old])
    upsert_records(db_session, [new])
    rows = db_session.execute(text("SELECT name FROM resource WHERE name = '복지관'")).fetchall()
    assert len(rows) == 1
