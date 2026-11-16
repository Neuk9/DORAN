from dataclasses import dataclass, field

from app.schemas import Candidate, ResourceView, ScoredCandidate
from app.services.llm.base import LLMProvider

FORBIDDEN_PATTERNS = ["받을 수 있습니다", "보장됩니다", "100%"]


@dataclass
class SourceCitation:
    source_dataset: str
    source_url: str | None = None
    captured_at: str | None = None


@dataclass
class Explanation:
    text: str
    citations: list[SourceCitation] = field(default_factory=list)
    forbidden_removed: bool = False


def sanitize_explanation(text: str) -> Explanation:
    removed = False
    for pattern in FORBIDDEN_PATTERNS:
        if pattern in text:
            removed = True
            text = text.replace(pattern, "담당자 확인이 필요합니다")
    return Explanation(text=text.strip(), forbidden_removed=removed)


def render_contact(phone: str | None, address: str | None) -> dict[str, str | None]:
    return {"phone": phone, "address": address}


async def explain(
    candidate: ScoredCandidate,
    resource: ResourceView,
    llm: LLMProvider,
) -> Explanation:
    reasons = " · ".join(candidate.reasons) or "조건과 일치하는 항목이 있습니다"
    text = f"{resource.name}은(는) {reasons}."
    result = sanitize_explanation(text)
    result.citations = [SourceCitation(
        source_dataset=resource.source_dataset,
        source_url=resource.source_url,
        captured_at=resource.captured_at.isoformat() if resource.captured_at else None,
    )]
    return result


def explain_gap(gap, indicators: list[dict], llm: LLMProvider | None = None) -> str:
    demand = float(getattr(gap, "demand_score", 0.0))
    supply = float(getattr(gap, "supply_score", 0.0))
    gap_score = float(getattr(gap, "gap_score", 0.0))
    level = "높음" if gap_score >= 70 else ("보통" if gap_score >= 40 else "낮음")
    return (
        f"이 지역의 수요 지수는 {demand:.1f}, 공급 지수는 {supply:.1f}입니다. "
        f"두 값의 차이로 계산한 격차 지수는 {gap_score:.1f}로 {level} 수준입니다. "
        "가중치 기반 참고 지표이므로 실제 정책 판단에는 현장 확인이 필요합니다."
    )
