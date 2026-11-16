import pytest

from app.schemas import SlotExtraction
from app.services.llm.base import LLMTimeout, Message
from app.services.llm.mock_provider import MockProvider


async def test_schema_violation_falls_back_to_template():
    provider = MockProvider(responses=['{"invalid": true}'])
    result = await provider.complete_json(system="s", user="u", schema=SlotExtraction, timeout_s=1)
    assert result.region_adm_cd is None
    assert result.missing_slots


async def test_timeout_raises_llm_timeout():
    provider = MockProvider(delay_s=2.0)
    with pytest.raises(LLMTimeout):
        await provider.complete_json(system="s", user="u", schema=SlotExtraction, timeout_s=0.1)


def test_message_type_exists():
    m: Message = {"role": "user", "content": "안녕"}
    assert m["role"] == "user"
