import uuid
from datetime import timedelta

from fastapi import APIRouter, Cookie, Depends, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Offering, Resource, SavedItem
from app.schemas import envelope
from app.timeutil import now_kst

router = APIRouter(prefix="/saved", tags=["saved"])


class SavedRequest(BaseModel):
    offering_id: str


def _sid(sid: str | None) -> str:
    return sid or uuid.uuid4().hex


@router.post("", status_code=201)
def save_item(
    payload: SavedRequest,
    response: Response,
    sid: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    session_id = _sid(sid)
    existing = db.execute(
        select(SavedItem).where(
            SavedItem.session_id == session_id,
            SavedItem.offering_id == payload.offering_id,
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(SavedItem(session_id=session_id, offering_id=payload.offering_id))
        db.commit()
    response.set_cookie("sid", session_id, max_age=86400, httponly=True, samesite="lax")
    return {"data": {"offering_id": payload.offering_id}, "meta": {"source": "saved"}}


@router.get("")
def list_saved(sid: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    if not sid:
        return envelope([], "saved")
    cutoff = now_kst() - timedelta(hours=24)
    rows = db.execute(
        select(SavedItem, Offering, Resource)
        .join(Offering, SavedItem.offering_id == Offering.id)
        .join(Resource, Offering.resource_id == Resource.id)
        .where(
            SavedItem.session_id == sid,
            SavedItem.created_at >= cutoff,
        )
        .order_by(Offering.apply_end.is_(None), Offering.apply_end, SavedItem.created_at.desc())
    ).all()
    data = [
        {
            "id": saved.id,
            "offering_id": saved.offering_id,
            "title": offering.title,
            "category": resource.category,
            "apply_end": offering.apply_end.isoformat() if offering.apply_end else None,
            "created_at": saved.created_at.isoformat() if saved.created_at else None,
        }
        for saved, offering, resource in rows
    ]
    return envelope(data, "saved")


@router.delete("/{offering_id}", status_code=204)
def remove_saved(
    offering_id: str,
    sid: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if sid:
        db.execute(delete(SavedItem).where(SavedItem.session_id == sid, SavedItem.offering_id == offering_id))
        db.commit()
    return Response(status_code=204)
