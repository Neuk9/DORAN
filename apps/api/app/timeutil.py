from datetime import date, datetime, time
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")


def now_kst() -> datetime:
    return datetime.now(KST)


def end_of_day_kst(d: date) -> datetime:
    return datetime.combine(d, time(23, 59, 59), tzinfo=KST)
