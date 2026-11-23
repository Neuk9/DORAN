from pymongo import ASCENDING, DESCENDING, GEOSPHERE, TEXT, AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings


class DatabaseManager:
    client: AsyncMongoClient | None = None
    db: AsyncDatabase | None = None

    async def connect(self, uri: str | None = None, db_name: str | None = None) -> AsyncDatabase:
        target_uri = uri or settings.mongodb_uri
        target_db = db_name or settings.mongodb_db
        self.client = AsyncMongoClient(target_uri, serverSelectionTimeoutMS=5000)
        self.db = self.client[target_db]
        await self.ensure_indexes(self.db)
        return self.db

    async def close(self) -> None:
        if self.client is not None:
            await self.client.close()
            self.client = None
            self.db = None

    async def ping(self) -> bool:
        if self.client is None:
            return False
        res = await self.client.admin.command("ping")
        return bool(res.get("ok"))

    async def ensure_indexes(self, db: AsyncDatabase) -> None:
        # programs 컬렉션: 로컬 Docker & MongoDB Atlas 공통 표준 인덱스
        programs = db["programs"]
        await programs.create_index([("externalId", ASCENDING)], unique=True)
        await programs.create_index([("location", GEOSPHERE)])
        await programs.create_index(
            [("region.admCd", ASCENDING), ("category", ASCENDING), ("deadline", ASCENDING)]
        )
        await programs.create_index([("region.sigungu", ASCENDING), ("category", ASCENDING)])
        await programs.create_index(
            [("title", TEXT), ("summary", TEXT), ("tags", TEXT)],
            default_language="none",
        )

        # region_stats 컬렉션
        regions = db["region_stats"]
        await regions.create_index([("admCd", ASCENDING)], unique=True)
        await regions.create_index([("center", GEOSPHERE)])
        await regions.create_index([("scores.gapIndex", DESCENDING)])
        await regions.create_index([("sigungu", ASCENDING), ("dong", ASCENDING)])

        # saved_sessions 컬렉션: 24시간 TTL 자동 만료
        saved = db["saved_sessions"]
        await saved.create_index([("sessionId", ASCENDING)], unique=True)
        await saved.create_index([("expiresAt", ASCENDING)], expireAfterSeconds=0)

        # demand_signals 컬렉션: 비식별 탐색 수요 집계 (원문/PII 미저장)
        signals = db["demand_signals"]
        await signals.create_index([("admCd", ASCENDING), ("category", ASCENDING)])
        await signals.create_index([("createdAt", DESCENDING)])


db_manager = DatabaseManager()


def get_db() -> AsyncDatabase:
    if db_manager.db is None:
        raise RuntimeError("Database is not initialized. Call db_manager.connect() first.")
    return db_manager.db
