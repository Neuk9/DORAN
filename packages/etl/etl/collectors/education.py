import hashlib
import re
from typing import Any

from etl.collectors.base import Collector, unwrap_items
from etl.dates import parse_kst_date
from etl.http import HttpClient
from etl.records import OfferingRecord


def parse_fee(text: str | None) -> int:
    if not text:
        return 0
    digits = re.sub(r"[^0-9]", "", text)
    return int(digits) if digits else 0


def parse_target_age(text: str | None) -> tuple[int | None, int | None]:
    if not text:
        return None, None
    # 초등 1~3학년 → 만 7~9세
    m = re.search(r"초등\s*(\d)\s*[~-]\s*(\d)", text)
    if m:
        return int(m.group(1)) + 6, int(m.group(2)) + 6
    m = re.search(r"초등\s*(\d)", text)
    if m:
        age = int(m.group(1)) + 6
        return age, age
    m = re.search(r"만?\s*(\d{1,2})\s*[~-]\s*(\d{1,2})\s*세", text)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None


class ShareNuriCollector(Collector):
    dataset = "sharenuri"
    url = "https://apis.data.go.kr/1741000/SharenuriEduInfo/getSharenuriEduInfo"

    def __init__(self, service_key: str | None = None, client: HttpClient | None = None):
        self.service_key = service_key
        self.client = client or HttpClient()

    def fetch(self) -> list[dict[str, Any]]:
        if not self.service_key:
            return []
        return unwrap_items(self.client.get_json(self.url, {"serviceKey": self.service_key}))

    extract_rows = staticmethod(unwrap_items)

    @staticmethod
    def normalize_rows(rows: list[dict[str, Any]]) -> list[OfferingRecord]:
        out: list[OfferingRecord] = []
        for row in rows:
            title = (row.get("강좌명") or "").strip()
            if not title:
                continue
            age_min, age_max = parse_target_age(row.get("대상"))
            org = (row.get("운영기관명") or row.get("기관명") or "").strip()
            out.append(
                OfferingRecord(
                    source_dataset="sharenuri",
                    source_id=hashlib.sha1(f"{org}|{title}".encode()).hexdigest()[:16],
                    resource_source_id=hashlib.sha1(org.encode("utf-8")).hexdigest()[:12]
                    if org
                    else "sharenuri",
                    title=title,
                    category="education",
                    target_age_min=age_min,
                    target_age_max=age_max,
                    target_group=row.get("대상") or None,
                    start_at=parse_kst_date(row.get("교육시작일")),
                    end_at=parse_kst_date(row.get("교육종료일")),
                    apply_start=parse_kst_date(row.get("접수시작일")),
                    apply_end=parse_kst_date(row.get("접수종료일")),
                    fee=parse_fee(row.get("수강료")),
                )
            )
        return out


class KmoocCollector(Collector):
    dataset = "kmooc"
    url = "https://apis.data.go.kr/B552881/kmooc/courseList"

    def __init__(self, service_key: str | None = None, client: HttpClient | None = None):
        self.service_key = service_key
        self.client = client or HttpClient()

    def fetch(self) -> list[dict[str, Any]]:
        if not self.service_key:
            return []
        return unwrap_items(self.client.get_json(self.url, {"ServiceKey": self.service_key}))

    @staticmethod
    def normalize_rows(rows: list[dict[str, Any]]) -> list[OfferingRecord]:
        out: list[OfferingRecord] = []
        for row in rows:
            title = (row.get("강좌명") or "").strip()
            if not title:
                continue
            org = (row.get("제공기관") or "").strip()
            out.append(
                OfferingRecord(
                    source_dataset="kmooc",
                    source_id=hashlib.sha1(title.encode("utf-8")).hexdigest()[:16],
                    resource_source_id=hashlib.sha1(org.encode("utf-8")).hexdigest()[:12] if org else "kmooc",
                    title=title,
                    category="education",
                    fee=parse_fee(row.get("수강료")),
                    description=row.get("강좌소개") or None,
                )
            )
        return out
