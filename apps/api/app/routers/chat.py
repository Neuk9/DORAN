from datetime import UTC, datetime, timedelta, timezone

from fastapi import APIRouter

from app.core.db import get_db
from app.models.schemas import (
    ApiResponse,
    ChatRecommendRequest,
    ChatRecommendResponse,
    ExcludedProgram,
    RecommendedProgram,
)
from app.services.eligibility import evaluate_eligibility
from app.services.explain import build_explanation
from app.services.gap import serialize_program
from app.services.llm.provider import get_llm_provider
from app.services.planner import (
    build_action_plan_and_docs,
    build_benefit_summary,
    find_hidden_gems,
)
from app.services.ranking import score_program
from app.services.safety import detect_crisis, mask_pii

router = APIRouter(prefix="/api/chat", tags=["chat"])
KST = timezone(timedelta(hours=9))


@router.post("/recommend", response_model=ApiResponse)
async def recommend_chat(payload: ChatRecommendRequest) -> ApiResponse:
    # 1) 위기 키워드 최우선 검사 (LLM 미호출, 원문 미저장)
    crisis = detect_crisis(payload.message)
    if crisis is not None:
        result = ChatRecommendResponse(
            crisis=crisis,
            summaryMessage=crisis.message,
            provider="safety-rule",
        )
        return ApiResponse(data=result.model_dump(mode="json"), meta={"crisisDetected": True})

    # 2) PII 마스킹 (상담 원문은 DB·로그에 절대 저장하지 않음)
    masked_text = mask_pii(payload.message)
    provider = get_llm_provider()

    # 3) 의도·상황 구조화 (사용자 수정 overrideProfile 우선 적용)
    if payload.overrideProfile is not None:
        profile = payload.overrideProfile
    else:
        profile = await provider.extract_profile(masked_text)

    db = get_db()

    user_coords: tuple[float, float] | None = None
    if payload.lat is not None and payload.lng is not None:
        user_coords = (payload.lat, payload.lng)

    target_adm = profile.admCd or payload.admCd
    if target_adm:
        region_doc = await db["region_stats"].find_one({"admCd": target_adm})
        if region_doc:
            profile.admCd = region_doc["admCd"]
            profile.sido = profile.sido or region_doc["sido"]
            profile.sigungu = profile.sigungu or region_doc["sigungu"]
            profile.dong = profile.dong or region_doc["dong"]
            if user_coords is None and region_doc.get("center"):
                coords = region_doc["center"]["coordinates"]
                user_coords = (coords[1], coords[0])
    elif profile.sigungu and user_coords is None:
        region_doc = await db["region_stats"].find_one({"sigungu": profile.sigungu})
        if region_doc and region_doc.get("center"):
            coords = region_doc["center"]["coordinates"]
            user_coords = (coords[1], coords[0])

    # 4) 전수 후보 조회 + 결정론 자격 판정 + 제외 사유 투명 기록 + 다차원 스코어링
    cursor = db["programs"].find({})
    now_kst = datetime.now(KST)
    scored: list[RecommendedProgram] = []
    excluded: list[ExcludedProgram] = []
    total_evaluated = 0

    async for doc in cursor:
        total_evaluated += 1
        prog = serialize_program(doc)
        evaluation = evaluate_eligibility(prog, profile, now=now_kst)
        if evaluation.status == "ineligible":
            excluded.append(
                ExcludedProgram(
                    programId=prog.id,
                    title=prog.title,
                    provider=prog.provider,
                    category=prog.category,
                    reasons=evaluation.unmetConditions,
                )
            )
            continue

        scores = score_program(prog, profile, evaluation, user_coords=user_coords)
        explanation = build_explanation(prog, profile, evaluation)
        scored.append(
            RecommendedProgram(
                program=prog,
                eligibility=evaluation,
                scores=scores,
                explanation=explanation,
            )
        )

    scored.sort(key=lambda item: item.scores.total, reverse=True)
    top_results = scored[: payload.limit]

    # 5) 예상 혜택 합산 · 숨은 혜택 발굴 · 3단계 실행 플랜 · 통합 구비서류 생성
    benefit_summary = build_benefit_summary(top_results)
    hidden_gems = find_hidden_gems(top_results, profile)
    action_plan, consolidated_docs = build_action_plan_and_docs(top_results)

    # 6) 비식별 탐색 수요 신호만 기록 (행정동 + 분야만 저장, 원문/PII 절대 미저장)
    if profile.admCd and profile.categories:
        now_utc = datetime.now(UTC)
        signal_docs = [
            {"admCd": profile.admCd, "category": cat, "createdAt": now_utc}
            for cat in profile.categories
        ]
        await db["demand_signals"].insert_many(signal_docs)

    summary = (
        f"전체 {total_evaluated}개 공공자원 중 자격·마감 기준으로 {len(excluded)}건을 제외하고, "
        f"신청 가능성이 높은 {len(top_results)}건을 맞춤 정리했습니다."
        if top_results
        else "현재 조건에 바로 일치하는 자원을 찾지 못했습니다. 조건을 넓혀 다시 확인해 보세요."
    )

    response = ChatRecommendResponse(
        crisis=None,
        maskedPreview=masked_text,
        profile=profile,
        recommendations=top_results,
        benefitSummary=benefit_summary,
        hiddenGems=hidden_gems,
        actionPlan=action_plan,
        consolidatedDocs=consolidated_docs,
        excludedPrograms=excluded[:8],
        totalEvaluatedCount=total_evaluated,
        totalExcludedCount=len(excluded),
        summaryMessage=summary,
        provider=provider.name,
    )
    return ApiResponse(
        data=response.model_dump(mode="json"),
        meta={
            "count": len(top_results),
            "evaluated": total_evaluated,
            "excluded": len(excluded),
            "provider": provider.name,
        },
    )
