import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.services.llm.base import LLMError, LLMSchemaError, LLMTimeout, parse_json_response


class OpenAIProvider:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini", base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    async def complete_json(
        self, *, system: str, user: str, schema: type[Any], timeout_s: float = 20.0
    ) -> Any:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                res = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json=payload,
                )
                res.raise_for_status()
        except httpx.TimeoutException as exc:
            raise LLMTimeout(str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 - transport/status/shape → LLMError
            raise LLMError(str(exc)) from exc
        try:
            raw = res.json()["choices"][0]["message"]["content"]
            data = parse_json_response(raw)
        except Exception as exc:  # noqa: BLE001
            raise LLMSchemaError(str(exc)) from exc
        try:
            return schema.model_validate(data)
        except Exception as exc:  # noqa: BLE001
            raise LLMSchemaError(str(exc)) from exc

    async def stream_text(
        self, *, system: str, messages: list[dict[str, str]], timeout_s: float = 20.0
    ) -> AsyncIterator[str]:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, *messages],
            "stream": True,
            "temperature": 0.3,
        }
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            ) as res:
                res.raise_for_status()
                async for line in res.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    chunk = line.removeprefix("data: ").strip()
                    if chunk == "[DONE]":
                        break
                    try:
                        delta = json.loads(chunk)["choices"][0]["delta"].get("content")
                    except (json.JSONDecodeError, KeyError):
                        continue
                    if delta:
                        yield delta
