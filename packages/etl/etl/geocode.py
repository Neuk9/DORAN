import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import requests
from shapely.geometry import Point, shape


@dataclass
class GeocodeResult:
    lat: float | None
    lng: float | None
    adm_cd: str | None
    precision: Literal["exact", "district", "none"]


class Geocoder:
    def __init__(self, kakao_key: str | None, regions_geojson: Path | str | None = None):
        self.kakao_key = kakao_key
        self.regions = self._load_regions(regions_geojson)

    @staticmethod
    def _load_regions(path: Path | str | None) -> list[dict]:
        if not path:
            return []
        p = Path(path)
        if not p.exists():
            return []
        data = json.loads(p.read_text(encoding="utf-8"))
        out = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            adm_cd = props.get("adm_cd") or props.get("ADM_CD")
            if adm_cd:
                out.append({"adm_cd": adm_cd, "geometry": shape(feature["geometry"])})
        return out

    def _call_kakao(self, address: str) -> tuple[float, float]:
        res = requests.get(
            "https://dapi.kakao.com/v2/local/search/address.json",
            params={"query": address},
            headers={"Authorization": f"KakaoAK {self.kakao_key}"},
            timeout=10,
        )
        res.raise_for_status()
        docs = res.json().get("documents", [])
        if not docs:
            raise LookupError("no address match")
        return float(docs[0]["y"]), float(docs[0]["x"])

    def _lookup_adm_cd(self, lng: float, lat: float) -> str | None:
        point = Point(lng, lat)
        for region in self.regions:
            if region["geometry"].contains(point):
                return region["adm_cd"]
        return None

    def resolve(self, address: str, sigungu_cd: str | None = None) -> GeocodeResult:
        address = (address or "").strip()
        if not address or not self.kakao_key:
            return GeocodeResult(None, None, None, "none")
        try:
            lat, lng = self._call_kakao(address)
        except Exception:  # noqa: BLE001 - any lookup failure degrades to district
            return GeocodeResult(None, None, None, "district")
        return GeocodeResult(lat, lng, self._lookup_adm_cd(lng, lat), "exact")
