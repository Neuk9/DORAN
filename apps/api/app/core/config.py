from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[4] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "doran"
    auto_seed_if_empty: bool = True

    llm_provider: str = "mock"  # mock | openai | gemini
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"

    kakao_api_key: str = ""
    data_go_kr_key: str = ""

    cors_origins: str = "http://localhost:3000"
    cors_origin_regex: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
