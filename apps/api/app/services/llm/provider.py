from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod

import httpx

from app.core.config import settings
from app.models.schemas import CategoryType, UserProfile

REGION_KEYWORDS: dict[str, tuple[str, str, str | None, str | None]] = {
    "구로3동": ("서울특별시", "구로구", "구로3동", "1153054000"),
    "구로5동": ("서울특별시", "구로구", "구로5동", "1153056000"),
    "신도림": ("서울특별시", "구로구", "신도림동", "1153051000"),
    "가리봉": ("서울특별시", "구로구", "가리봉동", "1153059500"),
    "개봉": ("서울특별시", "구로구", "개봉1동", "1153074000"),
    "오류": ("서울특별시", "구로구", "오류1동", "1153077000"),
    "구로구": ("서울특별시", "구로구", None, None),
    "구로": ("서울특별시", "구로구", None, None),
    "신림": ("서울특별시", "관악구", "신림동", "1162069500"),
    "관악": ("서울특별시", "관악구", None, None),
    "대림": ("서울특별시", "영등포구", "대림2동", "1156071000"),
    "영등포": ("서울특별시", "영등포구", None, None),
    "서울": ("서울특별시", "", None, None),
}

DOMAIN_KEYWORDS = [
    "악기", "기타", "통기타", "우쿨렐레", "피아노", "밴드", "공연", "클래식", "국악",
    "지원금", "월세", "수당", "장학금", "연금", "바우처", "난방비", "응시료", "자격증",
    "돌봄", "병원", "동행", "육아", "아동", "독서", "도서관",
    "스마트폰", "키오스크", "영어", "코딩", "AI", "데이터", "한국어", "다문화", "취업", "체조", "노래",
]


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def extract_profile(self, masked_text: str) -> UserProfile:
        raise NotImplementedError


class MockLLMProvider(LLMProvider):
    """API 키 없이도 동작하는 규칙·키워드 기반 자연어 구조화 파서."""

    name = "mock"

    async def extract_profile(self, masked_text: str) -> UserProfile:
        text = masked_text.strip()
        sido: str | None = None
        sigungu: str | None = None
        dong: str | None = None
        adm_cd: str | None = None

        for key, (r_sido, r_sgg, r_dong, r_adm) in REGION_KEYWORDS.items():
            if key in text:
                sido = r_sido or sido
                sigungu = r_sgg or sigungu
                dong = r_dong or dong
                adm_cd = r_adm or adm_cd
                if r_dong or r_sgg:
                    break

        age: int | None = None
        age_exact = re.search(r"(?:만\s*)?(\d{1,2})\s*세|(\d{1,2})\s*살", text)
        if age_exact:
            age = int(age_exact.group(1) or age_exact.group(2))
        else:
            decade = re.search(r"(\d0)\s*대", text)
            if decade:
                age = int(decade.group(1)) + 4
            elif any(w in text for w in ["어르신", "노인", "고령", "할머니", "할아버지", "독거노인"]):
                age = 70
            elif any(w in text for w in ["대학생", "청년"]):
                age = 24

        target_groups: list[str] = []
        if any(w in text for w in ["대학생", "학생", "장학금", "등록금"]):
            target_groups.extend(["student", "youth"])
        if any(w in text for w in ["청년", "20대", "사회초년생", "자취", "1인가구"]):
            target_groups.append("youth")
        if any(w in text for w in ["취준", "취업", "미취업", "구직", "자격증"]):
            target_groups.append("job_seeker")
        if any(w in text for w in ["어르신", "노인", "고령", "65세", "독거", "할머니", "할아버지"]):
            target_groups.append("senior")
        if any(w in text for w in ["저소득", "수급자", "차상위", "형편", "어려", "난방비", "생계"]):
            target_groups.append("low_income")
        if any(w in text for w in ["아이", "어린이", "육아", "맞벌이", "가족", "다문화", "결혼이민", "신혼"]):
            target_groups.append("family")
        target_groups = list(dict.fromkeys(target_groups))

        categories: list[CategoryType] = []
        if any(w in text for w in ["지원금", "복지", "월세", "수당", "연금", "돌봄", "병원", "바우처", "난방", "응시료"]):
            categories.append("welfare")
        if any(w in text for w in ["교육", "배우", "강좌", "수업", "스마트폰", "키오스크", "영어", "코딩", "AI", "장학금", "한국어", "취업"]):
            categories.append("education")
        if any(w in text for w in ["문화", "악기", "기타", "피아노", "공연", "음악", "연습실", "도서관", "노래", "체조", "취미", "동아리"]):
            categories.append("culture")
        categories = list(dict.fromkeys(categories))

        prefer_free = any(w in text for w in ["무료", "공짜", "부담 없", "돈 안", "지원금", "수당", "바우처"])

        time_prefs: list[str] = []
        if any(w in text for w in ["주말", "토요일", "일요일"]):
            time_prefs.append("weekend")
        if any(w in text for w in ["야간", "저녁", "퇴근", "밤"]):
            time_prefs.append("weekday_evening")
        if any(w in text for w in ["평일", "오전", "낮"]):
            time_prefs.append("weekday_day")
        if any(w in text for w in ["온라인", "집에서", "비대면"]):
            time_prefs.append("online")

        keywords = [kw for kw in DOMAIN_KEYWORDS if kw.lower() in text.lower()]

        return UserProfile(
            sido=sido,
            sigungu=sigungu or None,
            dong=dong,
            admCd=adm_cd,
            age=age,
            targetGroups=target_groups,
            categories=categories,
            preferFree=prefer_free,
            timePreferences=time_prefs,
            keywords=keywords,
        )


SYSTEM_PROMPT = """당신은 한국 공공·복지·교육·문화 자원 탐색 플랫폼 '도란도란'의 자연어 의도 추출기입니다.
사용자의 문장을 읽고 아래 JSON 스키마로만 응답하세요. 추측해서 없는 개인정보를 만들지 마세요.
{
  "sido": "서울특별시" | null,
  "sigungu": "구로구" | null,
  "dong": "구로3동" | null,
  "admCd": null,
  "age": number | null,
  "targetGroups": ["youth"|"student"|"senior"|"low_income"|"family"|"job_seeker"],
  "categories": ["welfare"|"education"|"culture"],
  "preferFree": boolean,
  "timePreferences": ["weekend"|"weekday_evening"|"weekday_day"|"online"],
  "keywords": [string]
}"""


class OpenAILLMProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model
        self._fallback = MockLLMProvider()

    async def extract_profile(self, masked_text: str) -> UserProfile:
        if not self.api_key:
            return await self._fallback.extract_profile(masked_text)
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={
                        "model": self.model,
                        "response_format": {"type": "json_object"},
                        "temperature": 0,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": masked_text},
                        ],
                    },
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                return UserProfile.model_validate(json.loads(content))
        except Exception:
            return await self._fallback.extract_profile(masked_text)


class GeminiLLMProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model or "gemini-2.5-flash"
        self._fallback = MockLLMProvider()

    async def extract_profile(self, masked_text: str) -> UserProfile:
        if not self.api_key:
            return await self._fallback.extract_profile(masked_text)
        try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{self.model}:generateContent?key={self.api_key}"
            )
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    url,
                    json={
                        "contents": [
                            {
                                "role": "user",
                                "parts": [{"text": f"{SYSTEM_PROMPT}\n\n사용자 입력: {masked_text}"}],
                            }
                        ],
                        "generationConfig": {
                            "temperature": 0,
                            "responseMimeType": "application/json",
                        },
                    },
                )
                resp.raise_for_status()
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                return UserProfile.model_validate(json.loads(text))
        except Exception:
            return await self._fallback.extract_profile(masked_text)


def get_llm_provider() -> LLMProvider:
    provider = settings.llm_provider.lower().strip()
    if provider == "openai" and settings.llm_api_key:
        return OpenAILLMProvider(settings.llm_api_key, settings.llm_model)
    if provider == "gemini" and settings.llm_api_key:
        return GeminiLLMProvider(settings.llm_api_key, settings.llm_model)
    return MockLLMProvider()
