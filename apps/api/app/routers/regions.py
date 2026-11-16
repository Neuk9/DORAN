from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import GapIndex, Region
from app.schemas import envelope
from app.services.explain import explain_gap

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("/search")
def search_regions(q: str = Query(default="", max_length=50), db: Session = Depends(get_db)):
    stmt = select(Region).order_by(Region.name).limit(20)
    if q:
        stmt = stmt.where(Region.name.ilike(f"%{q}%"))
    rows = db.execute(stmt).scalars().all()
    data = [{"adm_cd": r.adm_cd, "name": r.name, "level": r.level} for r in rows]
    return envelope(data, "region")


@router.get("/{adm_cd}/gap")
def region_gap(adm_cd: str, db: Session = Depends(get_db)):
    row = db.execute(
        select(GapIndex).where(GapIndex.adm_cd == adm_cd).order_by(desc(GapIndex.period)).limit(1)
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="REGION_NOT_FOUND")
    region = db.get(Region, adm_cd)
    narrative = explain_gap(row, [])
    data = {
        "adm_cd": row.adm_cd,
        "name": region.name if region else None,
        "period": row.period,
        "demand_score": row.demand_score,
        "supply_score": row.supply_score,
        "gap_score": row.gap_score,
        "categories": row.category_scores or {},
        "narrative": narrative,
    }
    return envelope(data, "gap_index")
