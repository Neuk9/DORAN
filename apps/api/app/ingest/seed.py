import asyncio
from datetime import UTC, datetime

from pymongo import UpdateOne
from pymongo.asynchronous.database import AsyncDatabase

from app.core.db import db_manager
from app.ingest.seed_data import PROGRAMS_SEED, REGION_STATS_SEED
from app.services.gap import compute_region_scores


async def seed_database(db: AsyncDatabase) -> dict[str, int]:
    """Idempotent upsert for demo programs and dynamically scored region gap stats."""
    program_ops = []
    for doc in PROGRAMS_SEED:
        payload = {k: v for k, v in doc.items() if v is not None or k == "deadline"}
        # Sparse 2dsphere index works cleanest when null location is omitted
        if payload.get("location") is None:
            payload.pop("location", None)
        program_ops.append(
            UpdateOne(
                {"externalId": payload["externalId"]},
                {"$set": payload, "$setOnInsert": {"createdAt": datetime.now(UTC)}},
                upsert=True,
            )
        )

    scored_regions = compute_region_scores(REGION_STATS_SEED)
    region_ops = [
        UpdateOne(
            {"admCd": doc["admCd"]},
            {
                "$set": {
                    **doc,
                    "dataSource": doc.get("dataSource", "seed"),
                    "sourceNotes": doc.get("sourceNotes")
                    or ["오프라인 초기 시드(공공 API 키 연동 시 자동 교체)"],
                }
            },
            upsert=True,
        )
        for doc in scored_regions
    ]

    if program_ops:
        await db["programs"].bulk_write(program_ops, ordered=False)
    if region_ops:
        await db["region_stats"].bulk_write(region_ops, ordered=False)

    program_count = await db["programs"].count_documents({})
    region_count = await db["region_stats"].count_documents({})
    return {"programs": program_count, "regions": region_count}


async def main() -> None:
    db = await db_manager.connect()
    try:
        counts = await seed_database(db)
        print(f"[seed] 완료: programs={counts['programs']}, region_stats={counts['regions']}")
    finally:
        await db_manager.close()


if __name__ == "__main__":
    asyncio.run(main())
