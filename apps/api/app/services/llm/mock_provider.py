import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

from app.schemas import SlotExtraction
from app.services.llm.base import LLMTimeout


class MockProvider:
    """테스트/오프라인용. responses를 순서대로 소비한다."""

    def __init__(self, responses: list[str] | None = None, delay_s: float = 0.0):
        self.responses = list(responses or [])
        self.delay_s = delay_s
        self.calls: list[dict[str, Any]] = []

    async def complete_json(
        self, *, system: str, user: str, schema: type[Any], timeout_s: float = 20.0
    ) -> Any:
        self.calls.append({"system": system, "user": user})
        if self.delay_s > timeout_s:
            raise LLMTimeout(f"mock delay {self.delay_s}s > timeout {timeout_s}s")
        if self.delay_s:
            await asyncio.sleep(self.delay_s)
        raw = self.responses.pop(0) if self.responses else "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict) or not (set(data) & set(schema.model_fields)):
            if schema is SlotExtraction:
                return SlotExtraction(missing_slots=["region_adm_cd", "age_years"])
            return schema()
        return schema.model_validate(data)

    async def stream_text(
        self, *, system: str, messages: list[dict[str, str]], timeout_s: float = 20.0
    ) -> AsyncIterator[str]:
        if self.delay_s > timeout_s:
            raise LLMTimeout("mock stream timeout")
        text = self.responses.pop(0) if self.responses else "안내드릴 내용을 준비하고 있어요."
        for chunk in text.split():
            yield chunk + " "
