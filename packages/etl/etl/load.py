import uuid
from collections.abc import Iterable
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from etl.records import OfferingRecord, ResourceRecord

RESOURCE_SQL = text("""
INSERT INTO resource (
  id, kind, name, provider, category, subcategory, description, address, lat, lng,
  adm_cd, phone, homepage, target_text, cost_type, cost_amount, apply_method,
  apply_url, apply_start, apply_end, source_dataset, source_id, source_url,
  valid_from, updated_at, precision
) VALUES (
  :id, :kind, :name, :provider, :category, :subcategory, :description, :address, :lat, :lng,
  :adm_cd, :phone, :homepage, :target_text, :cost_type, :cost_amount, :apply_method,
  :apply_url, :apply_start, :apply_end, :source_dataset, :source_id, :source_url,
  :valid_from, :updated_at, :precision
)
ON CONFLICT (source_dataset, source_id, valid_from) DO UPDATE SET
  name = EXCLUDED.name, provider = EXCLUDED.provider, category = EXCLUDED.category,
  description = EXCLUDED.description, address = EXCLUDED.address, lat = EXCLUDED.lat,
  lng = EXCLUDED.lng, adm_cd = EXCLUDED.adm_cd, phone = EXCLUDED.phone,
  target_text = EXCLUDED.target_text, apply_url = EXCLUDED.apply_url,
  apply_end = EXCLUDED.apply_end, updated_at = EXCLUDED.updated_at,
  precision = EXCLUDED.precision
""")

DEDUPE_SQL = text("""
UPDATE offering o
SET resource_id = keep.id
FROM resource keep, resource dup
WHERE o.resource_id = dup.id
  AND dup.id <> keep.id
  AND dup.name = keep.name
  AND coalesce(dup.address, '') = coalesce(keep.address, '')
  AND dup.updated_at < keep.updated_at;

DELETE FROM resource a USING resource b
WHERE a.id <> b.id
  AND a.name = b.name
  AND coalesce(a.address, '') = coalesce(b.address, '')
  AND a.updated_at < b.updated_at
""")


def _as_datetime(value: Any, fallback: datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return fallback
    return fallback


def upsert_records(session: Session, records: Iterable[ResourceRecord]) -> int:
    now = datetime.now().astimezone()
    count = 0
    for r in records:
        session.execute(
            RESOURCE_SQL,
            {
                "id": str(uuid.uuid4()),
                "kind": r.kind,
                "name": r.name,
                "provider": r.provider,
                "category": r.category,
                "subcategory": r.subcategory,
                "description": r.description,
                "address": r.address,
                "lat": r.lat,
                "lng": r.lng,
                "adm_cd": r.adm_cd,
                "phone": r.phone,
                "homepage": r.homepage,
                "target_text": r.target_text,
                "cost_type": r.cost_type,
                "cost_amount": r.cost_amount,
                "apply_method": r.apply_method,
                "apply_url": r.apply_url,
                "apply_start": r.apply_start,
                "apply_end": r.apply_end,
                "source_dataset": r.source_dataset,
                "source_id": r.source_id,
                "source_url": r.source_url,
                "valid_from": r.valid_from or date.today(),
                "updated_at": _as_datetime(r.updated_at, now),
                "precision": r.precision,
            },
        )
        count += 1
    session.execute(DEDUPE_SQL)
    return count


def upsert_offerings(session: Session, offerings: Iterable[OfferingRecord]) -> int:
    count = 0
    for o in offerings:
        row = session.execute(
            text("SELECT id FROM resource WHERE source_dataset = :ds AND source_id = :sid"),
            {"ds": o.source_dataset, "sid": o.resource_source_id},
        ).fetchone()
        if row is None:
            continue
        session.execute(
            text("""
            INSERT INTO offering (
              id, resource_id, title, description, target_age_min, target_age_max,
              target_group, start_at, end_at, days_of_week, time_start, time_end,
              capacity, enrolled, fee, currency, apply_start, apply_end, status,
              source_dataset, source_id
            ) VALUES (
              :id, :resource_id, :title, :description, :target_age_min, :target_age_max,
              :target_group, :start_at, :end_at, :days_of_week, :time_start, :time_end,
              :capacity, :enrolled, :fee, 'KRW', :apply_start, :apply_end, :status,
              :source_dataset, :source_id
            )
            ON CONFLICT (source_dataset, source_id) DO UPDATE SET
              title = EXCLUDED.title, apply_start = EXCLUDED.apply_start,
              apply_end = EXCLUDED.apply_end, fee = EXCLUDED.fee,
              description = EXCLUDED.description
        """),
            {
                "id": str(uuid.uuid4()),
                "resource_id": row[0],
                "title": o.title,
                "description": o.description,
                "target_age_min": o.target_age_min,
                "target_age_max": o.target_age_max,
                "target_group": o.target_group,
                "start_at": o.start_at,
                "end_at": o.end_at,
                "days_of_week": o.days_of_week,
                "time_start": o.time_start,
                "time_end": o.time_end,
                "capacity": o.capacity,
                "enrolled": o.enrolled,
                "fee": o.fee,
                "apply_start": o.apply_start,
                "apply_end": o.apply_end,
                "status": o.status,
                "source_dataset": o.source_dataset,
                "source_id": o.source_id,
            },
        )
        count += 1
    return count
