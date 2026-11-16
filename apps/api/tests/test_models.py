from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db import SessionLocal
from app.models import Region, Resource

pytestmark = pytest.mark.integration


def test_resource_unique_source_key():
    source_id = f"test-{uuid4()}"
    with SessionLocal() as s:
        s.add(Resource(source_dataset="ssis_local", source_id=source_id, kind="service",
                       name="A", category="care", valid_from=date(2026, 1, 1)))
        s.commit()
        s.add(Resource(source_dataset="ssis_local", source_id=source_id, kind="service",
                       name="A", category="care", valid_from=date(2026, 1, 1)))
        with pytest.raises(IntegrityError):
            s.commit()
        s.rollback()
        s.execute(text("DELETE FROM resource WHERE source_id = :sid"), {"sid": source_id})
        s.commit()


def test_region_geometry_optional():
    adm_cd = f"9{uuid4().int % 10**9:09d}"
    with SessionLocal() as s:
        s.add(Region(adm_cd=adm_cd, name="테스트동", level="dong", parent_cd="99999"))
        s.commit()
        assert s.get(Region, adm_cd).name == "테스트동"
        s.delete(s.get(Region, adm_cd))
        s.commit()
