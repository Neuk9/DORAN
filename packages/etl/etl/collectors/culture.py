import hashlib
from typing import Any

from etl.collectors.base import Collector, unwrap_items
from etl.dates import parse_kst_date
from etl.http import HttpClient
from etl.records import OfferingRecord, ResourceRecord


class CultureFacilityCollector(Collector):
    dataset = "culture_facilities"
    url = "https://apis.data.go.kr/B553457/rgnCltrFcltExmnv1/clifLvclCntrv1"

    def __init__(self, service_key: str | None = None, client: HttpClient | None = None):
        self.service_key = service_key
        self.client = client or HttpClient()

    def fetch(self) -> list[dict[str, Any]]:
        if not self.service_key:
            return []
        return unwrap_items(self.client.get_json(self.url, {"serviceKey": self.service_key}))

    @staticmethod
    def normalize_rows(rows: list[dict[str, Any]]) -> list[ResourceRecord]:
        out: list[ResourceRecord] = []
        for row in rows:
            name = (row.get("fcltNm") or "").strip()
            if not name:
                continue
            out.append(
                ResourceRecord(
                    source_dataset="culture_facilities",
                    source_id=(row.get("fcltCd") or hashlib.sha1(name.encode()).hexdigest()[:12]),
                    kind="facility",
                    name=name,
                    category="culture",
                    subcategory=row.get("fcltSe") or None,
                    address=row.get("adres") or None,
                    phone=row.get("telno") or None,
                    homepage=row.get("hmpg") or None,
                    description=row.get("prgrm") or None,
                )
            )
        return out


class CultureEduCollector(Collector):
    dataset = "culture_edu"
    url = "https://apis.data.go.kr/B553457/cultureEduResource/program"

    def __init__(self, service_key: str | None = None, client: HttpClient | None = None):
        self.service_key = service_key
        self.client = client or HttpClient()

    def fetch(self) -> list[dict[str, Any]]:
        if not self.service_key:
            return []
        return unwrap_items(self.client.get_json(self.url, {"serviceKey": self.service_key}))

    @staticmethod
    def normalize_rows(rows: list[dict[str, Any]]) -> list[OfferingRecord]:
        out: list[OfferingRecord] = []
        for row in rows:
            org = (row.get("단체명") or "").strip()
            title = (row.get("프로그램명") or "").strip()
            if not title:
                continue
            org_id = hashlib.sha1(org.encode("utf-8")).hexdigest()[:12] if org else "culture-edu"
            out.append(
                OfferingRecord(
                    source_dataset="culture_edu",
                    source_id=hashlib.sha1(f"{org}|{title}".encode()).hexdigest()[:16],
                    resource_source_id=org_id,
                    title=title,
                    category="education",
                    start_at=parse_kst_date(row.get("교육시작일")),
                    end_at=parse_kst_date(row.get("교육종료일")),
                    apply_start=parse_kst_date(row.get("신청시작일")),
                    apply_end=parse_kst_date(row.get("신청종료일")),
                    fee=0,
                )
            )
        return out
