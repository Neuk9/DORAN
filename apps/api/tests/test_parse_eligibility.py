from app.schemas import EligibilityRule
from app.services.llm.mock_provider import MockProvider
from app.services.parse_eligibility import parse_eligibility


async def test_parse_eligibility_returns_rule_from_llm():
    provider = MockProvider(responses=[
        '{"age": {"min": 6, "max": 12}, "confidence": 0.8, "source_fields": ["지원대상"]}'
    ])
    rule = await parse_eligibility({"지원대상": "초등학생"}, provider)
    assert isinstance(rule, EligibilityRule)
    assert rule.age.min == 6
    assert rule.confidence == 0.8
