from app.schemas import AgeRange, EligibilityRule, SearchCriteria
from app.services.eligibility import evaluate


def test_age_outside_range_is_ineligible():
    rule = EligibilityRule(age=AgeRange(min=6, max=12), confidence=0.9)
    state = evaluate(rule, SearchCriteria(age_years=15))
    assert state == "ineligible"


def test_low_confidence_is_needs_check_not_ineligible():
    rule = EligibilityRule(age=AgeRange(min=6, max=12), confidence=0.4)
    state = evaluate(rule, SearchCriteria(age_years=15))
    assert state == "needs_check"


def test_missing_rule_is_needs_check():
    assert evaluate(None, SearchCriteria(age_years=8)) == "needs_check"
