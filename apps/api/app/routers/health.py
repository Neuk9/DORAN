from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    version = None
    try:
        with SessionLocal() as session:
            version = session.execute(
                text("SELECT version FROM snapshot ORDER BY captured_at DESC LIMIT 1")
            ).scalar()
    except Exception:  # noqa: BLE001 - health must never fail
        version = None
    return {"status": "ok", "snapshot_version": version, "llm_provider": settings.llm_provider}
