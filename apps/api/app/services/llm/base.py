import json
from collections.abc import AsyncIterator
from typing import Any, Protocol, TypedDict

from app.schemas import SlotExtraction  # re-export for tests and callers


class Message(TypedDict):
    role: str
    content: str


class LLMError(Exception):
    pass


class LLMTimeout(LLMError):
    pass


class LLMSchemaError(LLMError):
    pass


class LLMProvider(Protocol):
    async def complete_json(
        self, *, system: str, user: str, schema: type[Any], timeout_s: float = 20.0
    ) -> Any: ...

    def stream_text(
        self, *, system: str, messages: list[Message], timeout_s: float = 20.0
    ) -> AsyncIterator[str]: ...


def parse_json_response(raw: str) -> dict[str, Any]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMSchemaError(str(exc)) from exc
    if not isinstance(data, dict):
        raise LLMSchemaError("response is not an object")
    return data
