import httpx
import pytest

from app.services.llm.base import LLMError
from app.services.llm.openai_provider import OpenAIProvider


async def test_connect_error_wrapped_as_llm_error(monkeypatch):
    provider = OpenAIProvider(api_key="x")

    async def boom(*args, **kwargs):
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(httpx.AsyncClient, "post", boom)
    with pytest.raises(LLMError):
        await provider.complete_json(system="s", user="u", schema=type("S", (), {}))


async def test_http_error_wrapped_as_llm_error(monkeypatch):
    provider = OpenAIProvider(api_key="x")

    class Resp:
        status_code = 401

        def raise_for_status(self):
            raise httpx.HTTPStatusError("401", request=None, response=None)  # type: ignore[arg-type]

    async def fake_post(*args, **kwargs):
        return Resp()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    with pytest.raises(LLMError):
        await provider.complete_json(system="s", user="u", schema=type("S", (), {}))
