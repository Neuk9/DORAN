from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import EligibilityRule, Offering, Resource
from app.schemas import Candidate, SearchCriteria, envelope
from app.services.geo import distance_from
from app.services.ranking import rank_candidates
from app.timeutil import now_kst

router = APIRouter(prefix="/recommend", tags=["recommend"])


@router.post("")
def recommend(criteria: SearchCriteria, db: Session = Depends(get_db)):
    now = now_kst()
    stmt = (
        select(Offering, Resource)
        .join(Resource, Offering.resource_id == Resource.id)
        .where(or_(Offering.apply_end.is_(None), Offering.apply_end >= now))
    )
    if criteria.adm_cd:
        stmt = stmt.where(Resource.adm_cd == criteria.adm_cd)
    rows = db.execute(stmt.limit(200)).all()

    candidates: list[Candidate] = []
    for offering, resource in rows:
        rule = db.get(EligibilityRule, (resource.id, "v1"))
        candidates.append(Candidate(
            offering_id=offering.id,
            resource_id=resource.id,
            category=resource.category,
            title=offering.title,
            resource_name=resource.name,
            apply_end=offering.apply_end,
            fee=offering.fee,
            distance_km=distance_from(criteria.lat, criteria.lng, resource.adm_cd,
                                      resource.lat, resource.lng),
            days_of_week=offering.days_of_week or [],
            target_age_min=offering.target_age_min,
            target_age_max=offering.target_age_max,
            updated_at=resource.updated_at,
            eligibility=rule.rule_json if rule else None,
            source=resource.source_dataset,
            source_url=resource.source_url,
            captured_at=resource.updated_at,
            lat=resource.lat,
            lng=resource.lng,
        ))

    ranked = rank_candidates(candidates, criteria, now=now, limit=5)
    data = [r.model_dump(mode="json") for r in ranked]
    return envelope(data, "recommend")
