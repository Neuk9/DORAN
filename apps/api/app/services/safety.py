import re

from app.models.schemas import CrisisContact, CrisisResponse

CRISIS_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("suicide", re.compile(r"(자살|자해|죽고\s*싶|극단적\s*선택|목숨을\s*끊)", re.IGNORECASE)),
    ("abuse", re.compile(r"(아동\s*학대|노인\s*학대|가정\s*폭력|맞고\s*있|폭행당)", re.IGNORECASE)),
    ("emergency_living", re.compile(r"(단전|단수|가스\s*끊|며칠째\s*굶|갈\s*곳이\s*없어\s*노숙)", re.IGNORECASE)),
]

PII_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(?<!\d)\d{6}-?[1-4]\d{6}(?!\d)"), "[주민번호 보호]"),
    (re.compile(r"(?<!\d)01[016789]-?\d{3,4}-?\d{4}(?!\d)"), "[전화번호 보호]"),
    (re.compile(r"(?<!\d)0\d{1,2}-\d{3,4}-\d{4}(?!\d)"), "[전화번호 보호]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[이메일 보호]"),
    (re.compile(r"(?<!\d)\d{4}-\d{4}-\d{4}-\d{4}(?!\d)"), "[카드번호 보호]"),
]


def detect_crisis(text: str) -> CrisisResponse | None:
    """위기 신호 감지 시 LLM을 호출하지 않고 즉시 긴급 연락처를 반환합니다."""
    matched = [name for name, pattern in CRISIS_PATTERNS if pattern.search(text)]
    if not matched:
        return None

    return CrisisResponse(
        detected=True,
        message=(
            "지금 매우 긴급하거나 위험한 상황으로 보입니다. "
            "혼자 감당하지 마시고 즉시 아래 긴급 지원 기관에 도움을 요청해 주세요."
        ),
        contacts=[
            CrisisContact(name="긴급 신고 (경찰)", number="112", description="폭력·학대·신변 위험 즉시 출동"),
            CrisisContact(name="응급 구조 (소방)", number="119", description="응급 의료·구조 요청"),
            CrisisContact(name="보건복지상담센터", number="129", description="긴급복지(단전·단수·생계위기)·위기가구 지원"),
            CrisisContact(name="여성긴급전화", number="1366", description="가정폭력·성폭력·긴급 보호 24시간 상담"),
            CrisisContact(name="자살예방상담전화", number="109", description="24시간 무료 위기 심리상담"),
        ],
    )


def mask_pii(text: str) -> str:
    """LLM 전송 전 개인식별정보(PII)를 마스킹합니다."""
    masked = text
    for pattern, token in PII_PATTERNS:
        masked = pattern.sub(token, masked)
    return masked
