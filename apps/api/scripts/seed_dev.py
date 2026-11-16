"""개발/E2E용 고정 시드. 데모 지역·자원·오퍼링·수요지표·격차 지수를 넣는다."""
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(ROOT / "packages" / "etl"))

from app.db import SessionLocal  # noqa: E402
from etl.indicators import compute_demand, compute_gap, compute_supply  # noqa: E402

KST = ZoneInfo("Asia/Seoul")
NOW = datetime.now(KST)

REGIONS = [
    ("2711053000", "수성동", "dong", "27110", 35.84, 128.62),
    ("2711054000", "범어동", "dong", "27110", 35.85, 128.63),
    ("4719051000", "경산중앙동", "dong", "47190", 35.82, 128.74),
]

# id, name, category, kind, address, adm_cd, lat, lng
RESOURCES = [
    ("r1", "수성노인복지관", "care", "facility", "대구 수성구 범어로 100", "2711053000", 35.8400, 128.6200),
    ("r2", "수성구 가족센터", "care", "facility", "대구 수성구 달구벌대로 200", "2711053000", 35.8450, 128.6250),
    ("r3", "수성구립도서관", "culture", "facility", "대구 수성구 상록로 30", "2711053000", 35.8420, 128.6300),
    ("r4", "수성문화재단", "culture", "facility", "대구 수성구 무학로 40", "2711053000", 35.8380, 128.6180),
    ("r5", "수성평생학습관", "education", "facility", "대구 수성구 청수로 50", "2711053000", 35.8470, 128.6270),
    ("r6", "경산시니어클럽", "care", "facility", "경북 경산시 중앙로 10", "4719051000", 35.8250, 128.7380),
    ("r7", "경산시립도서관", "culture", "facility", "경북 경산시 원효로 20", "4719051000", 35.8200, 128.7420),
    ("r8", "경산청소년문화의집", "culture", "facility", "경북 경산시 대학로 60", "4719051000", 35.8180, 128.7450),
    ("r9", "경산평생학습센터", "education", "facility", "경북 경산시 장산로 70", "4719051000", 35.8300, 128.7350),
    ("r10", "수성구 통합돌봄지원센터", "care", "service", "대구 수성구 범어로 120", "2711053000", 35.8410, 128.6210),
    ("r11", "경산시 긴급복지지원", "living", "service", "경북 경산시 중앙로 30", "4719051000", 35.8240, 128.7390),
    ("r12", "수성구 청년센터", "education", "facility", "대구 수성구 동대구로 80", "2711054000", 35.8500, 128.6280),
]

# id, resource, title, fee, apply_end, age_min, age_max, days
OFFERINGS = [
    ("o1", "r1", "어르신 건강교실", 0, NOW + timedelta(days=7), 60, 99, [0, 2]),
    ("o2", "r1", "독거노인 반찬배달", 0, None, 60, 99, []),
    ("o3", "r2", "초등 방학돌봄교실", 0, NOW + timedelta(days=3), 7, 9, [0, 1, 2, 3, 4]),
    ("o4", "r3", "어린이 독서교실", 0, NOW + timedelta(days=10), 7, 10, [6]),
    ("o5", "r3", "시니어 그림책 읽기", 0, None, 60, 99, [3]),
    ("o6", "r4", "생활문화 원데이클래스", 10000, NOW + timedelta(days=5), 19, 99, [6]),
    ("o7", "r5", "엄마와 함께하는 코딩", 0, NOW + timedelta(days=2), 7, 9, [6]),
    ("o8", "r5", "중장년 재취업 특강", 0, NOW + timedelta(days=14), 40, 65, [2]),
    ("o9", "r6", "노인 일자리 상담", 0, None, 60, 99, [1, 3]),
    ("o10", "r7", "작은도서관 문화강좌", 0, NOW + timedelta(days=9), 7, 99, [6]),
    ("o11", "r8", "청소년 진로캠프", 0, NOW + timedelta(days=6), 13, 18, [6]),
    ("o12", "r9", "경력단절여성 새일찾기", 0, NOW + timedelta(days=12), 25, 55, [1]),
    ("o13", "r10", "찾아가는 돌봄상담", 0, None, 60, 99, [0, 1, 2, 3, 4]),
    ("o14", "r11", "긴급 생계비 지원", 0, None, 19, 99, []),
    ("o15", "r12", "청년 취업 멘토링", 0, NOW + timedelta(days=8), 19, 34, [4]),
    ("o16", "r2", "다문화 가족 한국어교실", 0, NOW + timedelta(days=4), 19, 99, [2, 4]),
    ("o17", "r4", "주말 가족 영화상영", 0, NOW + timedelta(days=1), 0, 99, [6]),
    ("o18", "r5", "어르신 스마트폰 교실", 0, None, 60, 99, [1]),
    ("o19", "r7", "북스타트 프로그램", 0, NOW + timedelta(days=20), 0, 7, [3]),
    ("o20", "r9", "은퇴자 인생설계 강좌", 0, None, 55, 99, [4]),
]

DEMAND = {
    "2711053000": {"senior_single_ratio": 22.0, "basic_livelihood_ratio": 6.5,
                   "child_ratio": 14.0, "disabled_ratio": 5.2},
    "2711054000": {"senior_single_ratio": 15.0, "basic_livelihood_ratio": 4.0,
                   "child_ratio": 16.0, "disabled_ratio": 4.1},
    "4719051000": {"senior_single_ratio": 29.0, "basic_livelihood_ratio": 9.5,
                   "child_ratio": 12.0, "disabled_ratio": 7.8},
}
POPULATION = {"2711053000": 28000, "2711054000": 31000, "4719051000": 19000}


def main() -> None:
    demand_rows = [
        {"adm_cd": adm, "indicator_code": code, "value": value}
        for adm, values in DEMAND.items()
        for code, value in values.items()
    ]
    dummy_resources = [
        SimpleNamespace(adm_cd=r[5]) for r in RESOURCES
    ]
    d = compute_demand(demand_rows)
    s = compute_supply(dummy_resources, POPULATION)
    gaps = compute_gap(d, s)

    with SessionLocal() as session:
        for table in ("saved_item", "offering", "eligibility_rule", "resource",
                      "gap_index", "demand_indicator", "region", "snapshot"):
            session.execute(text(f"DELETE FROM {table}"))

        for adm_cd, name, level, parent, lat, lng in REGIONS:
            session.execute(
                text("INSERT INTO region (adm_cd, name, level, parent_cd) "
                     "VALUES (:a, :n, :l, :p)"),
                {"a": adm_cd, "n": name, "l": level, "p": parent},
            )

        for rid, name, cat, kind, addr, adm, lat, lng in RESOURCES:
            session.execute(
                text("""INSERT INTO resource
                  (id, kind, name, provider, category, address, lat, lng, adm_cd,
                   source_dataset, source_id, valid_from, updated_at, precision)
                  VALUES (:id, :kind, :name, NULL, :cat, :addr, :lat, :lng, :adm,
                          'seed', :sid, :vf, :ua, 'exact')"""),
                {"id": rid, "kind": kind, "name": name, "cat": cat, "addr": addr,
                 "lat": lat, "lng": lng, "adm": adm, "sid": rid,
                 "vf": date.today(), "ua": NOW},
            )

        for oid, rid, title, fee, apply_end, age_min, age_max, days in OFFERINGS:
            session.execute(
                text("""INSERT INTO offering
                  (id, resource_id, title, target_age_min, target_age_max,
                   fee, currency, apply_start, apply_end, status, source_dataset,
                   source_id, days_of_week, capacity)
                  VALUES (:id, :rid, :title, :amin, :amax, :fee, 'KRW',
                          :as_, :ae, :status, 'seed', :sid, :days, 20)"""),
                {"id": oid, "rid": rid, "title": title, "amin": age_min, "amax": age_max,
                 "fee": fee, "as_": NOW - timedelta(days=10), "ae": apply_end,
                 "status": "open" if apply_end is None or apply_end > NOW else "expired",
                 "sid": oid, "days": json.dumps(days)},
            )

        for adm, values in DEMAND.items():
            for code, value in values.items():
                session.execute(
                    text("""INSERT INTO demand_indicator
                      (adm_cd, period, indicator_code, value, unit, source, captured_at)
                      VALUES (:a, :p, :c, :v, '%', 'seed', :ca)"""),
                    {"a": adm, "p": NOW.strftime("%Y-%m"), "c": code, "v": value,
                     "ca": NOW},
                )

        for adm, gap in gaps.items():
            session.execute(
                text("""INSERT INTO gap_index
                  (adm_cd, period, demand_score, supply_score, gap_score, category_scores)
                  VALUES (:a, :p, :d, :s, :g, :c)"""),
                {"a": adm, "p": NOW.strftime("%Y-%m"), "d": gap.demand_score,
                 "s": gap.supply_score, "g": gap.gap_score,
                 "c": json.dumps(gap.categories)},
            )

        session.execute(
            text("""INSERT INTO snapshot
              (version, dataset, captured_at, row_count, checksum, status)
              VALUES (:v, 'seed', :ca, :n, NULL, 'ok')"""),
            {"v": NOW.strftime("%Y%m%d"), "ca": NOW, "n": len(RESOURCES)},
        )
        session.commit()
    print("seeded demo data (computed gaps)")


if __name__ == "__main__":
    main()
