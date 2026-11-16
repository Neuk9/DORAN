from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass
class ResourceRecord:
    source_dataset: str
    source_id: str
    kind: str
    name: str
    category: str
    provider: str | None = None
    subcategory: str | None = None
    description: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    adm_cd: str | None = None
    phone: str | None = None
    homepage: str | None = None
    target_text: str | None = None
    cost_type: str | None = None
    cost_amount: int | None = None
    apply_method: str | None = None
    apply_url: str | None = None
    apply_start: datetime | None = None
    apply_end: datetime | None = None
    source_url: str | None = None
    valid_from: date | None = None
    updated_at: datetime | None = None
    precision: str = "none"


@dataclass
class OfferingRecord:
    source_dataset: str
    source_id: str
    resource_source_id: str
    title: str
    category: str
    description: str | None = None
    target_age_min: int | None = None
    target_age_max: int | None = None
    target_group: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    days_of_week: list[int] = field(default_factory=list)
    time_start: str | None = None
    time_end: str | None = None
    capacity: int | None = None
    enrolled: int | None = None
    fee: int = 0
    apply_start: datetime | None = None
    apply_end: datetime | None = None
    status: str = "open"


@dataclass
class DemandIndicatorRecord:
    adm_cd: str
    period: str
    indicator_code: str
    value: float
    unit: str
    source: str
    captured_at: datetime | None = None
