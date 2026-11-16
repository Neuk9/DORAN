import hashlib
from typing import Any

from etl.collectors.base import Collector, unwrap_items
from etl.dates import parse_kst_date
from etl.http import HttpClient
from etl.records import OfferingRecord, ResourceRecord


class SsisFacilityCollector(Collector):
    dataset = "ssis_facilities"
    url = "https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService2/getFcltListInfoInqire2"

    def __init__(self, service_key: str | None = None, client: HttpClient | None = None):
        self.service_key = service_key
        self.client = client or HttpClient()

    def fetch(self) -> list[dict[str, Any]]:
        if not self.service_key:
            return []
        return unwrap_items(self.client.get_json(self.url, {"serviceKey": self.service_key}))

    @staticmethod
    def normalize_rows(rows: list[dict[str, Any]]) -> tuple[list[ResourceRecord], list[OfferingRecord]]:
        resources: list[ResourceRecord] = []
        offerings: list[OfferingRecord] = []
        for row in rows:
            name = (row.get("fcltNm") or "").strip()
            if not name:
                continue
            facility_id = (row.get("fcltCd") or "").strip() or hashlib.sha1(
                f"{name}|{row.get('fcltAddr', '')}".encode()
            ).hexdigest()[:12]
            address = (
                " ".join(
                    filter(
                        None,
                        [
                            (row.get("fcltAddr") or "").strip(),
                            (row.get("fcltDtl_1Addr") or "").strip(),
                        ],
                    )
                )
                or None
            )
            resources.append(
                ResourceRecord(
                    source_dataset="ssis_facilities",
                    source_id=facility_id,
                    kind="facility",
                    name=name,
                    category="care",
                    provider=row.get("fcltKindNm") or None,
                    address=address,
                    phone=(row.get("fcltTelNo") or None),
                    target_text=row.get("fcltUseRcpnNm") or None,
                    source_url=row.get("homepageAddr") or None,
                )
            )
            title = (row.get("title") or "").strip()
            if title:
                offerings.append(
                    OfferingRecord(
                        source_dataset="ssis_facilities",
                        source_id=f"{facility_id}-{hashlib.sha1(title.encode()).hexdigest()[:8]}",
                        resource_source_id=facility_id,
                        title=title,
                        category="care",
                        description=row.get("etcMtr") or None,
                        apply_start=parse_kst_date(row.get("accpBgnDe")),
                        apply_end=parse_kst_date(row.get("accpClseDe")),
                    )
                )
        return resources, offerings
