from etl.indicators import WEIGHTS, compute_demand, compute_gap


def test_weights_sum_to_one():
    assert round(sum(WEIGHTS.values()), 6) == 1.0


def test_missing_indicator_renormalizes():
    d = compute_demand(
        [
            {"adm_cd": "A", "indicator_code": "senior_single_ratio", "value": 20.0},
            {"adm_cd": "B", "indicator_code": "senior_single_ratio", "value": 10.0},
        ]
    )
    assert 0 <= d["A"] <= 100 and 0 <= d["B"] <= 100


def test_gap_stays_in_range_when_supply_missing():
    g = compute_gap({"A": 80.0}, {})
    assert 0 <= g["A"].gap_score <= 100
    assert g["A"].supply_score == 0.0
