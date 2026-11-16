import uuid
from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def new_id() -> str:
    return str(uuid.uuid4())


class Region(Base):
    __tablename__ = "region"

    adm_cd: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    level: Mapped[str] = mapped_column(String(10))
    parent_cd: Mapped[str | None] = mapped_column(String(10), nullable=True)
    geometry: Mapped[object | None] = mapped_column(
        Geometry("MULTIPOLYGON", srid=4326, nullable=True)
    )


class DemandIndicator(Base):
    __tablename__ = "demand_indicator"

    adm_cd: Mapped[str] = mapped_column(String(10), primary_key=True)
    period: Mapped[str] = mapped_column(String(7), primary_key=True)
    indicator_code: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(10), default="%")
    source: Mapped[str] = mapped_column(String(50))
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Resource(Base):
    __tablename__ = "resource"
    __table_args__ = (
        UniqueConstraint("source_dataset", "source_id", "valid_from", name="uq_resource_source"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    kind: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200))
    provider: Mapped[str | None] = mapped_column(String(200), nullable=True)
    category: Mapped[str] = mapped_column(String(20))
    subcategory: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    adm_cd: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    homepage: Mapped[str | None] = mapped_column(String(500), nullable=True)
    target_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cost_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    apply_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    apply_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    apply_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    apply_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_dataset: Mapped[str] = mapped_column(String(50))
    source_id: Mapped[str] = mapped_column(String(100))
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    precision: Mapped[str] = mapped_column(String(20), default="none")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Offering(Base):
    __tablename__ = "offering"
    __table_args__ = (
        UniqueConstraint("source_dataset", "source_id", name="uq_offering_source"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    resource_id: Mapped[str] = mapped_column(
        ForeignKey("resource.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_age_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_age_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_group: Mapped[str | None] = mapped_column(String(100), nullable=True)
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    days_of_week: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    time_start: Mapped[str | None] = mapped_column(String(5), nullable=True)
    time_end: Mapped[str | None] = mapped_column(String(5), nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    enrolled: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fee: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="KRW")
    apply_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    apply_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
    source_dataset: Mapped[str] = mapped_column(String(50))
    source_id: Mapped[str] = mapped_column(String(100))


class EligibilityRule(Base):
    __tablename__ = "eligibility_rule"

    resource_id: Mapped[str] = mapped_column(
        ForeignKey("resource.id", ondelete="CASCADE"), primary_key=True
    )
    parser_version: Mapped[str] = mapped_column(String(20), primary_key=True)
    rule_json: Mapped[dict] = mapped_column(JSONB)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    parsed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GapIndex(Base):
    __tablename__ = "gap_index"

    adm_cd: Mapped[str] = mapped_column(String(10), primary_key=True)
    period: Mapped[str] = mapped_column(String(7), primary_key=True)
    demand_score: Mapped[float] = mapped_column(Float)
    supply_score: Mapped[float] = mapped_column(Float)
    gap_score: Mapped[float] = mapped_column(Float)
    category_scores: Mapped[dict] = mapped_column(JSONB, default=dict)


class Snapshot(Base):
    __tablename__ = "snapshot"

    version: Mapped[str] = mapped_column(String(20), primary_key=True)
    dataset: Mapped[str] = mapped_column(String(50), primary_key=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ok")


class SavedItem(Base):
    __tablename__ = "saved_item"
    __table_args__ = (
        UniqueConstraint("session_id", "offering_id", name="uq_saved_item"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    session_id: Mapped[str] = mapped_column(String(64), index=True)
    offering_id: Mapped[str] = mapped_column(String(36), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
