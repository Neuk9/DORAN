from datetime import UTC, datetime, timedelta

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException

from app.core.db import get_db
from app.models.schemas import ApiResponse, ProgramOut, SavedChecklistOut, SavedUpdateRequest
from app.services.gap import serialize_program

router = APIRouter(prefix="/api/saved", tags=["saved"])
SESSION_TTL_HOURS = 24


async def _load_saved_items(session_id: str) -> SavedChecklistOut:
    db = get_db()
    session_doc = await db["saved_sessions"].find_one({"sessionId": session_id})
    if not session_doc:
        return SavedChecklistOut(sessionId=session_id, expiresAt=None, items=[])

    raw_ids = session_doc.get("programIds", [])
    obj_ids = [ObjectId(pid) for pid in raw_ids if ObjectId.is_valid(str(pid))]
    items: list[ProgramOut] = []
    if obj_ids:
        cursor = db["programs"].find({"_id": {"$in": obj_ids}})
        async for doc in cursor:
            items.append(serialize_program(doc))

    # 마감 임박순 정렬 (상시 모집은 뒤쪽)
    def sort_key(p: ProgramOut) -> tuple[int, float]:
        if p.isAlwaysOpen or p.deadline is None:
            return (1, float("inf"))
        return (0, p.deadline.timestamp())

    items.sort(key=sort_key)
    return SavedChecklistOut(
        sessionId=session_id,
        expiresAt=session_doc.get("expiresAt"),
        items=items,
    )


@router.get("", response_model=ApiResponse)
async def get_saved_checklist(
    x_session_id: str = Header(..., min_length=4, max_length=128, alias="X-Session-Id"),
) -> ApiResponse:
    checklist = await _load_saved_items(x_session_id)
    return ApiResponse(data=checklist.model_dump(mode="json"), meta={"ttlHours": SESSION_TTL_HOURS})


@router.post("", response_model=ApiResponse)
async def add_saved_program(
    payload: SavedUpdateRequest,
    x_session_id: str = Header(..., min_length=4, max_length=128, alias="X-Session-Id"),
) -> ApiResponse:
    if not ObjectId.is_valid(payload.programId):
        raise HTTPException(status_code=400, detail="유효하지 않은 프로그램 ID입니다.")

    db = get_db()
    exists = await db["programs"].find_one({"_id": ObjectId(payload.programId)}, {"_id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="프로그램을 찾을 수 없습니다.")

    expires_at = datetime.now(UTC) + timedelta(hours=SESSION_TTL_HOURS)
    await db["saved_sessions"].update_one(
        {"sessionId": x_session_id},
        {
            "$addToSet": {"programIds": payload.programId},
            "$set": {"expiresAt": expires_at},
        },
        upsert=True,
    )
    checklist = await _load_saved_items(x_session_id)
    return ApiResponse(data=checklist.model_dump(mode="json"), meta={"ttlHours": SESSION_TTL_HOURS})


@router.delete("/{program_id}", response_model=ApiResponse)
async def remove_saved_program(
    program_id: str,
    x_session_id: str = Header(..., min_length=4, max_length=128, alias="X-Session-Id"),
) -> ApiResponse:
    db = get_db()
    expires_at = datetime.now(UTC) + timedelta(hours=SESSION_TTL_HOURS)
    await db["saved_sessions"].update_one(
        {"sessionId": x_session_id},
        {
            "$pull": {"programIds": program_id},
            "$set": {"expiresAt": expires_at},
        },
    )
    checklist = await _load_saved_items(x_session_id)
    return ApiResponse(data=checklist.model_dump(mode="json"), meta={"ttlHours": SESSION_TTL_HOURS})
