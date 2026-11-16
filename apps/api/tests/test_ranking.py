from datetime import datetime, timezone

from app.schemas import Candidate, SearchCriteria
from app.services.ranking import WEIGHTS, rank_candidates


def test_weights_sum_to_one():
    assert round(sum(WEIGHTS.values()), 6) == 1.0


def test_missing_distance_is_neutral_not_crash():
    c = Candidate(offering_id="o1", resource_id="r1", category="care", title="A",
                  distance_km=None, updated_at=datetime(2026, 11, 1, tzinfo=timezone.utc))
    out = rank_candidates([c], SearchCriteria(), now=datetime(2026, 11, 17, tzinfo=timezone.utc))
    assert out[0].score > 0
    assert "거리 정보 없음" in out[0].reasons


def test_expired_candidate_excluded():
    c = Candidate(offering_id="o2", resource_id="r2", category="care", title="B",
                  apply_end=datetime(2026, 11, 16, 23, 59, 59, tzinfo=timezone.utc),
                  updated_at=datetime(2026, 11, 1, tzinfo=timezone.utc))
    out = rank_candidates([c], SearchCriteria(), now=datetime(2026, 11, 17, tzinfo=timezone.utc))
    assert out == []
