import hashlib
import xml.etree.ElementTree as ET
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from etl.collectors.base import Collector
from etl.http import HttpClient
from etl.records import ResourceRecord

KST = ZoneInfo("Asia/Seoul")

# 원본 OpenAPI 응답 태그 → 내부 필드명
TAG_MAP = {
    "servNm": "서비스명",
    "servDgst": "서비스요약",
    "trgterIndvdlArray": "지원대상",
    "servUrl": "서비스URL",
    "rprsCtadr": "대표문의",
    "srvPvsnNm": "제공기관",
    "jurMnofNm": "소관부처",
    "sggNm": "시군구",
    "ctpvNm": "시도",
    "sprtCycNm": "지원주기",
    "onapPsbltYn": "신청가능여부",
}


def parse_items(xml_text: str) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    rows: list[dict[str, Any]] = []
    for item in root.iter("item"):
        row: dict[str, Any] = {}
        for child in item:
            key = TAG_MAP.get(child.tag, child.tag)
            row[key] = (child.text or "").strip()
        if row:
            rows.append(row)
    return rows


def stable_source_id(name: str, region: str, url: str | None) -> str:
    if url:
        tail = url.rstrip("/").split("/")[-1]
        if tail:
            return tail
    return hashlib.sha1(f"{name}|{region}".encode("utf-8")).hexdigest()[:12]


class _SsisWelfareBase:
    dataset = ""
    url = ""

    def __init__(self, service_key: str | None = None, client: HttpClient | None = None):
        self.service_key = service_key
        self.client = client or HttpClient()

    def fetch(self) -> list[dict[str, Any]]:
        if not self.service_key:
            return []
        text = self.client.get_text(self.url, {"ServiceKey": self.service_key})
        return parse_items(text)

    @classmethod
    def normalize_rows(cls, rows: list[dict[str, Any]]) -> list[ResourceRecord]:
        out: list[ResourceRecord] = []
        for row in rows:
            name = (row.get("서비스명") or "").strip()
            if not name:
                continue
            url = (row.get("서비스URL") or "").strip() or None
            region = (row.get("소관시군구코드") or row.get("시군구") or "").strip()
            out.append(
                ResourceRecord(
                    source_dataset=cls.dataset,
                    source_id=stable_source_id(name, region, url),
                    kind="service",
                    name=name,
                    category="care",
                    provider=row.get("제공기관") or row.get("소관부처"),
                    description=row.get("서비스요약"),
                    target_text=row.get("지원대상") or None,
                    apply_method=row.get("신청방법") or None,
                    apply_url=url,
                    phone=row.get("대표문의") or None,
                    source_url=url,
                    valid_from=date.today(),
                    updated_at=datetime.now(KST),
                )
            )
        return out


class SsisLocalWelfareCollector(_SsisWelfareBase, Collector):
    dataset = "ssis_local"
    url = "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformationsV001/LocalGovernmentWelfarelistV001"


class SsisCentralWelfareCollector(_SsisWelfareBase, Collector):
    dataset = "ssis_central"
    url = "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001"
