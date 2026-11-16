from dataclasses import dataclass, field
from statistics import median
from typing import Any, Iterable, Mapping

WEIGHTS: dict[str, float] = {
    "senior_single_ratio": 0.25,
    "basic_livelihood_ratio": 0.20,
    "near_poor_ratio": 0.15,
    "child_ratio": 0.15,
    "disabled_ratio": 0.10,
    "old_housing_ratio": 0.05,
    "transit_vulnerability": 0.10,
}

CATEGORY_MAP = {
    "care": "돌봄",
    "education": "교육",
    "culture": "문화",
    "living": "생활지원",
}


def _mad(values: list[float]) -> float:
    if not values:
        return 0.0
    med = median(values)
    return median([abs(v - med) for v in values])


def _robust_minmax(values: dict[str, float]) -> dict[str, float]:
    if not values:
        return {}
    if len(values) == 1:
        return {k: 50.0 for k in values}
    med = median(list(values.values()))
    scale = max(_mad(list(values.values())), 1e-9)
    z = {k: (v - med) / scale for k, v in values.items()}
    lo, hi = min(z.values()), max(z.values())
    if hi - lo < 1e-9:
        return {k: 50.0 for k in z}
    return {k: (v - lo) / (hi - lo) * 100 for k, v in z.items()}


def _zscore(values: dict[str, float]) -> dict[str, float]:
    if not values:
        return {}
    if len(values) == 1:
        return {k: 0.0 for k in values}
    mean = sum(values.values()) / len(values)
    var = sum((v - mean) ** 2 for v in values.values()) / len(values)
    std = var ** 0.5
    if std < 1e-9:
        return {k: 0.0 for k in values}
    return {k: (v - mean) / std for k, v in values.items()}


def compute_demand(rows: Iterable[Mapping[str, Any]]) -> dict[str, float]:
    by_region: dict[str, dict[str, float]] = {}
    for row in rows:
        adm_cd = str(row.get("adm_cd") or "")
        code = str(row.get("indicator_code") or "")
        if not adm_cd or code not in WEIGHTS:
            continue
        try:
            value = float(row.get("value"))
        except (TypeError, ValueError):
            continue
        by_region.setdefault(adm_cd, {})[code] = value

    scaled: dict[str, dict[str, float]] = {code: {} for code in WEIGHTS}
    for code in WEIGHTS:
        values = {adm: ind[code] for adm, ind in by_region.items() if code in ind}
        scaled[code] = _robust_minmax(values)

    out: dict[str, float] = {}
    for adm, indicators in by_region.items():
        total_weight = sum(WEIGHTS[c] for c in indicators if c in WEIGHTS)
        if total_weight <= 0:
            continue
        score = sum(scaled[c].get(adm, 0.0) * WEIGHTS[c] for c in indicators)
        out[adm] = round(score / total_weight, 2)
    return out


def compute_supply(
    resources: Iterable[Any],
    populations: Mapping[str, int] | None = None,
) -> dict[str, float]:
    counts: dict[str, int] = {}
    for r in resources:
        adm = getattr(r, "adm_cd", None) or (r.get("adm_cd") if isinstance(r, Mapping) else None)
        if not adm:
            continue
        counts[adm] = counts.get(adm, 0) + 1
    densities: dict[str, float] = {}
    for adm, count in counts.items():
        pop = (populations or {}).get(adm) or 0
        densities[adm] = count / (pop / 10000) if pop > 0 else float(count)
    return _robust_minmax(densities)


@dataclass
class GapResult:
    demand_score: float
    supply_score: float
    gap_score: float
    categories: dict[str, float] = field(default_factory=dict)


def compute_gap(
    demand: Mapping[str, float],
    supply: Mapping[str, float],
    category_demand: Mapping[str, Mapping[str, float]] | None = None,
    category_supply: Mapping[str, Mapping[str, float]] | None = None,
) -> dict[str, GapResult]:
    adm_cds = sorted(set(demand) | set(supply))
    if not adm_cds:
        return {}
    demand_full = {a: float(demand.get(a, 0.0)) for a in adm_cds}
    supply_full = {a: float(supply.get(a, 0.0)) for a in adm_cds}
    zd = _zscore(demand_full)
    zs = _zscore(supply_full)
    diff = {a: zd[a] - zs[a] for a in adm_cds}
    lo, hi = min(diff.values()), max(diff.values())
    if hi - lo < 1e-9:
        gaps = {a: 50.0 for a in adm_cds}
    else:
        gaps = {a: (v - lo) / (hi - lo) * 100 for a, v in diff.items()}

    category_scores: dict[str, dict[str, float]] = {}
    for cat in CATEGORY_MAP:
        cd = (category_demand or {}).get(cat, {})
        cs = (category_supply or {}).get(cat, {})
        if cd or cs:
            sub = compute_gap(cd, cs)
            category_scores[cat] = {a: g.gap_score for a, g in sub.items()}

    return {
        a: GapResult(
            demand_score=round(demand_full[a], 2),
            supply_score=round(supply_full[a], 2),
            gap_score=round(gaps[a], 2),
            categories={c: round(v[a], 2) for c, v in category_scores.items() if a in v},
        )
        for a in adm_cds
    }
