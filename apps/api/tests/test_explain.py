from app.services.explain import FORBIDDEN_PATTERNS, explain_gap, render_contact, sanitize_explanation
from app.services.llm.mock_provider import MockProvider


def test_forbidden_guarantee_phrase_is_removed():
    out = sanitize_explanation("이 서비스를 받을 수 있습니다. 거리가 가깝습니다.")
    assert "받을 수 있습니다" not in out.text
    assert out.forbidden_removed is True
    assert "거리가 가깝습니다" in out.text


def test_forbidden_patterns_are_declared():
    assert "받을 수 있습니다" in FORBIDDEN_PATTERNS


def test_phone_and_address_are_rendered_from_db():
    assert render_contact("02-123-4567", "서울 ...") == {"phone": "02-123-4567", "address": "서울 ..."}


def test_gap_narrative_uses_only_computed_values():
    gap = type("G", (), {"demand_score": 82.0, "supply_score": 31.0, "gap_score": 87.0})()
    text = explain_gap(gap, [], MockProvider(responses=["무시됨"]))
    assert "82.0" in text and "31.0" in text and "87.0" in text
