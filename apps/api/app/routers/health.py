from fastapi import APIRouter

from app.core.config import settings
from app.core.db import db_manager
from app.models.schemas import ApiResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=ApiResponse)
async def health_check() -> ApiResponse:
    db_ok = await db_manager.ping()
    return ApiResponse(
        data={
            "status": "ok" if db_ok else "degraded",
            "database": "connected" if db_ok else "disconnected",
            "llmProvider": settings.llm_provider,
        },
        meta={"service": "doran-api", "version": "0.2.0"},
    )
