import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import EligibilityRule, Offering, Resource
from app.schemas import Candidate, SearchCriteria, SlotExtraction
from app.services.crisis import detect_crisis
from app.services.geo import distance_from
from app.services.llm.base import LLMError, LLMProvider
from app.services.llm.factory import get_llm
from app.services.pii import mask_pii
from app.services.ranking import rank_candidates
from app.services.sessions import store
from app.timeutil import now_kst

router = APIRouter(prefix="/chat", tags=["chat"])

SYSTEM = (
    "너는 지역 복지·교육·문화 자원 상담 도우미다. 사용자의 상황에서 "
    "지역, 나이, 가구유형, 돌봄 필요, 관심분야, 이동 가능시간, 예산, 긴급도를 추출한다. "
    "확실하지 않은 값은 비워 두고 missing_slots에 넣는다. 제공된 JSON 스키마로만 답한다."
)


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


async def extract_slots(
    message: str, llm: LLMProvider, previous: SlotExtraction | None = None
) -> SlotExtraction:
    result = await llm.complete_json(system=SYSTEM, user=message, schema=SlotExtraction)
    if not isinstance(result, SlotExtraction):
        result = SlotExtraction()
    return merge_slots(previous, result)


def merge_slots(previous: SlotExtraction | None, new: SlotExtraction) -> SlotExtraction:
    if previous is None:
        merged = new.model_copy()
    else:
        merged = previous.model_copy()
        for field_name in (
            "region_adm_cd",
            "age_years",
            "budget_krw",
            "max_travel_minutes",
            "care_need",
            "interests",
            "household",
            "transport",
        ):
            value = getattr(new, field_name)
            if value:
                setattr(merged, field_name, value)
        if new.age_group != "unknown":
            merged.age_group = new.age_group
        if new.urgency != "normal":
            merged.urgency = new.urgency
    merged.missing_slots = [slot for slot in ("region_adm_cd", "age_years") if not getattr(merged, slot)]
    return merged


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _build_cards(db: Session, slots: SlotExtraction) -> list[dict]:
    now = now_kst()
    criteria = SearchCriteria(
        adm_cd=slots.region_adm_cd,
        age_years=slots.age_years,
        household=slots.household,
        care_need=slots.care_need,
        interests=slots.interests,
        budget_krw=slots.budget_krw,
        urgency=slots.urgency,
    )
    stmt = (
        select(Offering, Resource)
        .join(Resource, Offering.resource_id == Resource.id)
        .where(or_(Offering.apply_end.is_(None), Offering.apply_end >= now))
        .order_by(Offering.title)
        .limit(200)
    )
    if slots.region_adm_cd:
        stmt = stmt.where(Resource.adm_cd == slots.region_adm_cd)
    rows = db.execute(stmt).all()
    candidates = []
    for offering, resource in rows:
        rule = db.get(EligibilityRule, (resource.id, "v1"))
        candidates.append(
            Candidate(
                offering_id=offering.id,
                resource_id=resource.id,
                category=resource.category,
                title=offering.title,
                resource_name=resource.name,
                apply_end=offering.apply_end,
                fee=offering.fee,
                distance_km=distance_from(None, None, resource.adm_cd, resource.lat, resource.lng),
                target_age_min=offering.target_age_min,
                target_age_max=offering.target_age_max,
                updated_at=resource.updated_at,
                eligibility=rule.rule_json if rule else None,
                source=resource.source_dataset,
                source_url=resource.source_url,
                captured_at=resource.updated_at,
                lat=resource.lat,
                lng=resource.lng,
            )
        )
    ranked = rank_candidates(candidates, criteria, now=now, limit=5)
    return [
        {
            **r.model_dump(mode="json"),
            "source": r.source,
            "captured_at": r.captured_at.isoformat() if r.captured_at else None,
        }
        for r in ranked
    ]


@router.post("")
async def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    async def stream() -> AsyncIterator[str]:
        crisis = detect_crisis(payload.message)
        if crisis is not None:
            yield _sse(
                "crisis",
                {
                    "categories": crisis.categories,
                    "hotlines": crisis.hotlines,
                    "message": "지금 위험한 상황이라면 즉시 도움을 받아 주세요.",
                },
            )
            yield _sse("done", {})
            return
        llm = get_llm()
        session = store.get(payload.session_id)
        previous = SlotExtraction(**session.slots) if session.slots else None
        try:
            slots = await extract_slots(mask_pii(payload.message).text, llm, previous)
        except LLMError:
            yield _sse(
                "fallback",
                {
                    "message": "AI 응답이 지연되어 기본 안내로 진행합니다. "
                    "가까운 주민센터나 129에 문의해 주세요.",
                    "hotlines": ["129", "112", "119"],
                },
            )
            yield _sse("done", {})
            return

        session.slots = slots.model_dump()
        yield _sse("session", {"session_id": session.session_id})
        yield _sse("slot_update", slots.model_dump(mode="json"))
        try:
            cards = _build_cards(db, slots)
        except Exception:  # noqa: BLE001 - recommendation failure must not break chat
            cards = []
        yield _sse("cards", {"items": cards})
        text = (
            "조건에 맞는 자원을 찾았어요. 카드를 눌러 신청 방법을 확인하세요."
            if cards
            else "조건에 맞는 자원을 찾지 못했어요. 조건을 조금 넓혀 볼까요?"
        )
        yield _sse("message_delta", {"text": text})
        yield _sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream")
