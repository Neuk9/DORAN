from app.config import settings
from app.services.llm.base import LLMProvider
from app.services.llm.mock_provider import MockProvider
from app.services.llm.openai_provider import OpenAIProvider


def get_llm() -> LLMProvider:
    if settings.llm_provider == "openai" and settings.llm_api_key:
        return OpenAIProvider(api_key=settings.llm_api_key, model=settings.llm_model)
    return MockProvider()
