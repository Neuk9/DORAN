import math

REGION_CENTROIDS: dict[str, tuple[float, float]] = {
    "2711053000": (35.84, 128.62),
    "2711054000": (35.85, 128.63),
    "4719051000": (35.82, 128.74),
}


def region_center(adm_cd: str | None) -> tuple[float, float] | None:
    if not adm_cd:
        return None
    if adm_cd in REGION_CENTROIDS:
        return REGION_CENTROIDS[adm_cd]
    for code, center in REGION_CENTROIDS.items():
        if adm_cd.startswith(code[:5]):
            return center
    return None


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def distance_from(
    criteria_lat: float | None,
    criteria_lng: float | None,
    adm_cd: str | None,
    lat: float | None,
    lng: float | None,
) -> float | None:
    if lat is None or lng is None:
        return None
    origin = (
        (criteria_lat, criteria_lng)
        if criteria_lat is not None and criteria_lng is not None
        else region_center(adm_cd)
    )
    if origin is None or origin[0] is None or origin[1] is None:
        return None
    return haversine_km(origin[0], origin[1], lat, lng)
