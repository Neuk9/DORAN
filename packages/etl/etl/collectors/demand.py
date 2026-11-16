import re
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from etl.collectors.base import Collector, unwrap_items
from etl.http import HttpClient
from etl.records import DemandIndicatorRecord

KST = ZoneInfo("Asia/Seoul")

INDICATORS = (
    "senior_single_ratio",
    "basic_livelihood_ratio",
    "near_poor_ratio",
    "child_ratio",
    "disabled_ratio",
)


def _ratio(numerator: float | int | None, denominator: float | int | None) -> float | None:
    try:
        num = float(numerator or 0)
        den = float(denominator or 0)
    except (TypeError, ValueError):
        return None
    if den <= 0:
        return None
    return round(num / den * 100, 2)


class PopulationCollector(Collector):
    dataset = "population"
    url = "https://apis.data.go.kr/1741000/rdoaAdmmPpltnHh"

    def __init__(self, service_key: str | None = None, client: HttpClient | None = None):
        self.service_key = service_key
        self.client = client or HttpClient()

    def fetch(self) -> list[dict[str, Any]]:
        if not self.service_key:
            return []
        return unwrap_items(self.client.get_json(self.url, {"serviceKey": self.service_key}))

    @staticmethod
    def normalize_rows(rows: list[dict[str, Any]]) -> list[DemandIndicatorRecord]:
        out: list[DemandIndicatorRecord] = []
        now = datetime.now(KST)
        for row in rows:
            adm_cd = (row.get("adm_cd") or "").strip()
            period = (row.get("period") or "").strip()
            if not adm_cd or not period:
                continue
            value = _ratio(row.get("single_households_65plus"), row.get("total_households"))
            if value is None:
                continue
            out.append(DemandIndicatorRecord(
                adm_cd=adm_cd, period=period, indicator_code="senior_single_ratio",
                value=value, unit="%", source="행정안전부", captured_at=now,
            ))
        return out


class KosisCollector(Collector):
    dataset = "kosis"
    url = "https://kosis.kr/openapi/Param/statisticsParameterData.do"

    def __init__(self, service_key: str | None = None, client: HttpClient | None = None):
        self.service_key = service_key
        self.client = client or HttpClient()

    def fetch(self) -> list[dict[str, Any]]:
        if not self.service_key:
            return []
        return unwrap_items(self.client.get_json(self.url, {"apiKey": self.service_key}))

    @staticmethod
    def normalize_rows(rows: list[dict[str, Any]], indicator_code: str) -> list[DemandIndicatorRecord]:
        out: list[DemandIndicatorRecord] = []
        now = datetime.now(KST)
        for row in rows:
            if indicator_code not in INDICATORS:
                continue
            raw = str(row.get("DT") or "").replace(",", "").strip()
            try:
                value = float(raw)
            except ValueError:
                continue
            adm_cd = (row.get("C1") or "").strip()
            period = (row.get("PRD_DE") or "").strip()
            if not adm_cd or not period:
                continue
            out.append(DemandIndicatorRecord(
                adm_cd=adm_cd, period=period, indicator_code=indicator_code,
                value=value, unit=row.get("UNIT_NM") or "%", source="KOSIS", captured_at=now,
            ))
        return out
