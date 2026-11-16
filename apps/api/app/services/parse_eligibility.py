import json

from app.schemas import EligibilityRule
from app.services.llm.base import LLMProvider

SYSTEM = (
    "너는 사회보장 서비스의 지원대상·선정기준 문장을 구조화하는 도구다. "
    "제공된 텍스트에 없는 조건을 만들지 말고, 확신이 없으면 confidence를 낮게 둔다. "
    "반드시 주어진 JSON 스키마로만 답한다."
)


async def parse_eligibility(texts: dict[str, str], llm: LLMProvider) -> EligibilityRule:
    payload = json.dumps(texts, ensure_ascii=False)
    rule = await llm.complete_json(system=SYSTEM, user=payload, schema=EligibilityRule)
    if not isinstance(rule, EligibilityRule):
        return EligibilityRule()
    return rule
