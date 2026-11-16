from etl.collectors.demand import KosisCollector, PopulationCollector


def test_single_household_becomes_ratio():
    rows = [
        {
            "adm_cd": "2711053000",
            "period": "2026-10",
            "total_households": 1000,
            "single_households_65plus": 120,
        }
    ]
    recs = PopulationCollector.normalize_rows(rows)
    assert recs[0].indicator_code == "senior_single_ratio"
    assert recs[0].value == 12.0
    assert recs[0].unit == "%"


def test_zero_denominator_is_skipped():
    rows = [{"adm_cd": "A", "period": "2026-10", "total_households": 0, "single_households_65plus": 0}]
    assert PopulationCollector.normalize_rows(rows) == []


def test_kosis_maps_dt_to_float():
    rows = [
        {
            "ORG_ID": "101",
            "TBL_ID": "DT",
            "C1": "27110",
            "ITM_NM": "수급자",
            "DT": "1,234",
            "PRD_DE": "2025",
            "UNIT_NM": "명",
        }
    ]
    recs = KosisCollector.normalize_rows(rows, "basic_livelihood_ratio")
    assert recs[0].value == 1234.0
    assert recs[0].period == "2025"
