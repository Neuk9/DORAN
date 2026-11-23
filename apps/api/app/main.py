import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import db_manager
from app.ingest.seed import seed_database
from app.ingest.sync_public import sync_all_public_data
from app.routers import chat, health, programs, regions, saved

_bg_tasks: set[asyncio.Task] = set()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db = await db_manager.connect()
    if settings.auto_seed_if_empty:
        existing_programs = await db["programs"].estimated_document_count()
        existing_regions = await db["region_stats"].estimated_document_count()
        if existing_programs == 0 or existing_regions == 0:
            await seed_database(db)

    # 공공데이터포털 키가 설정돼 있고 12시간 이내 실데이터 동기화 이력이 없으면 백그라운드 자동 동기화
    if settings.data_go_kr_key:
        fresh_cutoff = datetime.now(UTC) - timedelta(hours=12)
        fresh_live = await db["region_stats"].count_documents(
            {"dataSource": "public_api", "updatedAt": {"$gte": fresh_cutoff}}
        )
        if fresh_live == 0:
            task = asyncio.create_task(sync_all_public_data(db))
            _bg_tasks.add(task)
            task.add_done_callback(_bg_tasks.discard)

    yield
    for task in list(_bg_tasks):
        task.cancel()
    await db_manager.close()


app = FastAPI(
    title="도란도란 (DORAN) API",
    description="AI 기반 개인 맞춤형 공공자원 추천 및 지역별 수요·공급 격차 분석 플랫폼 API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(programs.router)
app.include_router(chat.router)
app.include_router(regions.router)
app.include_router(saved.router)
