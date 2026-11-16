from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

DISCLAIMER = "본 정보는 공공데이터 기반 참고자료이며, 최종 자격·신청 가능 여부는 담당 기관에 확인하세요."


class SearchCriteria(BaseModel):
    adm_cd: str | None = None
    age_years: int | None = None
    household: list[str] = Field(default_factory=list)
    care_need: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    max_travel_minutes: int | None = None
    budget_krw: int | None = None
    time_window: dict[str, Any] | None = None
    urgency: Literal["low", "normal", "high"] = "normal"
    lat: float | None = None
    lng: float | None = None


class RegionSummary(BaseModel):
    adm_cd: str
    name: str
    level: str


class ResourceView(BaseModel):
    id: str
    name: str
    category: str
    provider: str | None = None
    address: str | None = None
    phone: str | None = None
    apply_url: str | None = None
    target_text: str | None = None
    source_dataset: str
    source_url: str | None = None
    captured_at: datetime | None = None


def envelope(
    data: Any,
    source: str,
    captured_at: datetime | None = None,
    snapshot_version: str | None = None,
) -> dict[str, Any]:
    return {
        "data": data,
        "meta": {
            "source": source,
            "captured_at": captured_at.isoformat() if captured_at else None,
            "snapshot_version": snapshot_version,
            "disclaimer": DISCLAIMER,
        },
    }


class AgeRange(BaseModel):
    min: int | None = None
    max: int | None = None


class IncomeRule(BaseModel):
    type: str = "median_percent"
    max: int = 100


class EligibilityRule(BaseModel):
    age: AgeRange | None = None
    household: list[str] = Field(default_factory=list)
    income: IncomeRule | None = None
    region_codes: list[str] = Field(default_factory=list)
    conditions_text: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    source_fields: list[str] = Field(default_factory=list)


class SlotExtraction(BaseModel):
    region_adm_cd: str | None = None
    age_group: Literal["child", "youth", "adult", "senior", "unknown"] = "unknown"
    age_years: int | None = None
    household: list[str] = Field(default_factory=list)
    care_need: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    time_window: dict[str, Any] | None = None
    max_travel_minutes: int | None = None
    transport: list[str] = Field(default_factory=list)
    budget_krw: int | None = None
    urgency: Literal["low", "normal", "high"] = "normal"
    missing_slots: list[str] = Field(default_factory=list)


class Candidate(BaseModel):
    offering_id: str
    resource_id: str
    category: str
    title: str
    resource_name: str | None = None
    apply_end: datetime | None = None
    fee: int = 0
    distance_km: float | None = None
    days_of_week: list[int] = Field(default_factory=list)
    time_start: str | None = None
    time_end: str | None = None
    target_age_min: int | None = None
    target_age_max: int | None = None
    updated_at: datetime
    eligibility: EligibilityRule | None = None
    source: str = ""
    source_url: str | None = None
    captured_at: datetime | None = None
    lat: float | None = None
    lng: float | None = None


class ScoredCandidate(Candidate):
    score: float
    reasons: list[str] = Field(default_factory=list)
    eligibility_state: Literal["eligible", "likely", "needs_check", "ineligible"] = "needs_check"
