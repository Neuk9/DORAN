from dataclasses import dataclass, field

WHITELIST = ["죽을 만큼", "죽은 듯", "죽을힘을 다해"]
CONTEXT_WORDS = ["예방", "교육", "프로그램", "캠페인", "강좌", "수업", "상담 안내"]
STRONG_SIGNALS = [
    "죽고 싶",
    "자살",
    "자해",
    "살고 싶지 않",
    "사라지고 싶",
    "극단적 선택",
    "못 살겠",
    "목숨을 끊",
    "죽여줘",
]
SIGNALS = {
    "abuse": ["학대", "맞고 있", "폭행당"],
    "emergency": ["단전", "단수", "노숙", "응급", "쓰러져", "살려주세요"],
}
HOTLINES = ["112", "119", "129", "1366", "1577-0199"]


@dataclass
class CrisisSignal:
    categories: list[str] = field(default_factory=list)
    hotlines: list[str] = field(default_factory=list)


def detect_crisis(text: str) -> CrisisSignal | None:
    cleaned = text
    for phrase in WHITELIST:
        cleaned = cleaned.replace(phrase, " ")

    if any(word in cleaned for word in STRONG_SIGNALS):
        return CrisisSignal(categories=["self_harm"], hotlines=HOTLINES)

    if any(word in cleaned for word in CONTEXT_WORDS):
        return None

    hits = [cat for cat, words in SIGNALS.items() if any(w in cleaned for w in words)]
    if not hits:
        return None
    return CrisisSignal(categories=hits, hotlines=HOTLINES)
