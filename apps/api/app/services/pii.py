import re
from dataclasses import dataclass, field

RRN = re.compile(r"\d{6}-?\d{7}")
PHONE = re.compile(r"(01[016789]|0[2-6][0-9]?)-?\d{3,4}-?\d{4}")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
ADDRESS = re.compile(r"\d+(-\d+)?\s*(동|호|번지)")


@dataclass
class MaskedText:
    text: str
    found: list[str] = field(default_factory=list)


def mask_pii(text: str) -> MaskedText:
    found: list[str] = []

    def replace(pattern: re.Pattern, label: str, value: str) -> str:
        if pattern.search(value):
            found.append(label)
            return pattern.sub(f"[{label.upper()}]", value)
        return value

    masked = replace(RRN, "rrn", text)
    masked = replace(PHONE, "phone", masked)
    masked = replace(EMAIL, "email", masked)
    masked = replace(ADDRESS, "address", masked)
    return MaskedText(text=masked, found=found)
