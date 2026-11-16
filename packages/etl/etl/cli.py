import argparse
import os
from pathlib import Path
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from etl.collectors.culture import CultureEduCollector, CultureFacilityCollector
from etl.collectors.demand import KosisCollector, PopulationCollector
from etl.collectors.education import KmoocCollector, ShareNuriCollector
from etl.collectors.ssis_facilities import SsisFacilityCollector
from etl.collectors.ssis_welfare import (
    SsisCentralWelfareCollector,
    SsisLocalWelfareCollector,
)
from etl.load import upsert_offerings, upsert_records
from etl.snapshot import SnapshotStore

ROOT = str(Path(__file__).resolve().parents[3])
SNAPSHOT_ROOT = os.path.join(ROOT, "data", "snapshots")
Path(SNAPSHOT_ROOT).mkdir(parents=True, exist_ok=True)

RESOURCE_COLLECTORS = {
    "ssis_local": SsisLocalWelfareCollector,
    "ssis_central": SsisCentralWelfareCollector,
    "culture_facilities": CultureFacilityCollector,
}
PAIR_COLLECTORS = {"ssis_facilities": SsisFacilityCollector}
OFFERING_COLLECTORS = {
    "sharenuri": ShareNuriCollector,
    "kmooc": KmoocCollector,
    "culture_edu": CultureEduCollector,
}


def main(dataset: str, snapshot_date: str | None = None) -> int:
    store = SnapshotStore(SNAPSHOT_ROOT)
    rows = store.read_latest(dataset) or []
    if not rows:
        print(f"no snapshot rows for {dataset}")
        return 1

    resources = []
    offerings = []
    if dataset in RESOURCE_COLLECTORS:
        resources = RESOURCE_COLLECTORS[dataset].normalize_rows(rows)
    elif dataset in PAIR_COLLECTORS:
        resources, offerings = PAIR_COLLECTORS[dataset].normalize_rows(rows)
    elif dataset in OFFERING_COLLECTORS:
        offerings = OFFERING_COLLECTORS[dataset].normalize_rows(rows)
    else:
        print(f"unknown dataset: {dataset}")
        return 2

    url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://bigdata:bigdata@localhost:5433/bigdata",
    )
    engine = create_engine(url)
    with sessionmaker(bind=engine)() as session:
        upsert_records(session, resources)
        upsert_offerings(session, offerings)
        session.commit()
    print(f"loaded {dataset}: {len(resources)} resources, {len(offerings)} offerings")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset")
    parser.add_argument("--date", default=None)
    args = parser.parse_args()
    raise SystemExit(main(args.dataset, args.date))
