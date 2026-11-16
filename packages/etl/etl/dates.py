from datetime import date, datetime, time
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")


def parse_kst_date(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = value.strip().replace("-", "").replace(".", "")
    if len(raw) < 8 or not raw[:8].isdigit():
        return None
    y, m, d = int(raw[:4]), int(raw[4:6]), int(raw[6:8])
    try:
        return datetime.combine(date(y, m, d), time(23, 59, 59), tzinfo=KST)
    except ValueError:
        return None
