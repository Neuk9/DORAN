from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import EligibilityRule, Offering, Resource
from app.schemas import envelope
from app.services.geo import distance_from
from app.timeutil import end_of_day_kst, now_kst

router = APIRouter(prefix="/programs", tags=["programs"])


def _summary(offering: Offering, resource: Resource,
             lat: float | None = None, lng: float | None = None) -> dict:
    return {
        "offering_id": offering.id,
        "resource_id": resource.id,
        "title": offering.title,
        "category": resource.category,
        "provider": resource.provider,
        "address": resource.address,
        "fee": offering.fee,
        "apply_end": offering.apply_end.isoformat() if offering.apply_end else None,
        "distance_km": distance_from(lat, lng, resource.adm_cd, resource.lat, resource.lng),
        "lat": resource.lat,
        "lng": resource.lng,
        "source": offering.source_dataset,
        "captured_at": resource.updated_at.isoformat() if resource.updated_at else None,
    }


@router.get("")
def list_programs(
    adm_cd: str | None = None,
    category: str | None = None,
    q: str | None = None,
    max_fee: int | None = None,
    weekday: int | None = Query(default=None, ge=0, le=6),
    deadline_within_days: int | None = Query(default=None, ge=0),
    lat: float | None = None,
    lng: float | None = None,
    max_distance_km: float | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    now = now_kst()
    stmt = (
        select(Offering, Resource)
        .join(Resource, Offering.resource_id == Resource.id)
        .where(Offering.status != "expired")
        .where(or_(Offering.apply_end.is_(None), Offering.apply_end >= now))
    )
    if adm_cd:
        stmt = stmt.where(Resource.adm_cd == adm_cd)
    if category:
        stmt = stmt.where(Resource.category == category)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(or_(Offering.title.ilike(pattern), Resource.name.ilike(pattern)))
    if max_fee is not None:
        stmt = stmt.where(Offering.fee <= max_fee)
    if weekday is not None:
        stmt = stmt.where(Offering.days_of_week.contains([weekday]))
    if deadline_within_days is not None:
        stmt = stmt.where(
            Offering.apply_end.is_not(None),
            Offering.apply_end <= end_of_day_kst(now.date() + timedelta(days=deadline_within_days)),
        )

    stmt = stmt.order_by(Offering.apply_end.is_(None), Offering.apply_end, Offering.title)
    rows = db.execute(stmt.offset((page - 1) * size).limit(size)).all()
    data = [_summary(o, r, lat, lng) for o, r in rows]
    if max_distance_km is not None:
        data = [d for d in data if d["distance_km"] is not None and d["distance_km"] <= max_distance_km]
    return envelope(data, "offering")


@router.get("/{offering_id}")
def get_program(offering_id: str, db: Session = Depends(get_db)):
    row = db.execute(
        select(Offering, Resource)
        .join(Resource, Offering.resource_id == Resource.id)
        .where(Offering.id == offering_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="PROGRAM_NOT_FOUND")
    offering, resource = row
    rule = db.get(EligibilityRule, (resource.id, "v1"))
    now = now_kst()
    stale = bool(
        resource.updated_at
        and (now - resource.updated_at).days > 90
    )
    data = {
        **_summary(offering, resource),
        "description": offering.description,
        "target_age_min": offering.target_age_min,
        "target_age_max": offering.target_age_max,
        "target_group": offering.target_group,
        "capacity": offering.capacity,
        "days_of_week": offering.days_of_week or [],
        "apply_start": offering.apply_start.isoformat() if offering.apply_start else None,
        "phone": resource.phone,
        "homepage": resource.homepage,
        "apply_url": resource.apply_url,
        "target_text": resource.target_text,
        "eligibility": rule.rule_json if rule else None,
        "eligibility_state": "needs_check",
        "stale": stale,
    }
    return envelope(data, offering.source_dataset, resource.updated_at)
