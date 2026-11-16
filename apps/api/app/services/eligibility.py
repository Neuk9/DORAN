from typing import Literal

from app.schemas import EligibilityRule, SearchCriteria

EligibilityState = Literal["eligible", "likely", "needs_check", "ineligible"]

CONFIDENCE_FLOOR = 0.6


def evaluate(rule: EligibilityRule | None, criteria: SearchCriteria) -> EligibilityState:
    if rule is None:
        return "needs_check"
    if rule.confidence < CONFIDENCE_FLOOR:
        return "needs_check"

    if rule.age and criteria.age_years is not None:
        if rule.age.min is not None and criteria.age_years < rule.age.min:
            return "ineligible"
        if rule.age.max is not None and criteria.age_years > rule.age.max:
            return "ineligible"

    if rule.region_codes and criteria.adm_cd:
        if not any(criteria.adm_cd.startswith(code) for code in rule.region_codes):
            return "ineligible"

    if rule.household and criteria.household:
        if not set(rule.household) & set(criteria.household):
            return "ineligible"

    return "eligible"
