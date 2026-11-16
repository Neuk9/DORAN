import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass
class SnapshotResult:
    dataset: str
    status: str
    row_count: int
    checksum: str | None
    path: Path | None


class SnapshotStore:
    def __init__(self, root: Path | str):
        self.root = Path(root)

    def _path(self, dataset: str, captured_at: datetime) -> Path:
        return self.root / captured_at.date().isoformat() / f"{dataset}.parquet"

    def write(self, dataset: str, rows: list[dict[str, Any]], captured_at: datetime) -> SnapshotResult:
        if not rows:
            return SnapshotResult(dataset=dataset, status="empty", row_count=0, checksum=None, path=None)
        path = self._path(dataset, captured_at)
        path.parent.mkdir(parents=True, exist_ok=True)
        df = pd.DataFrame(rows)
        df.to_parquet(path, index=False)
        checksum = hashlib.sha256(json.dumps(rows, default=str, sort_keys=True).encode("utf-8")).hexdigest()
        return SnapshotResult(dataset=dataset, status="ok", row_count=len(rows), checksum=checksum, path=path)

    def read_latest(self, dataset: str) -> list[dict[str, Any]] | None:
        files = sorted(self.root.glob(f"*/{dataset}.parquet"), reverse=True)
        for f in files:
            df = pd.read_parquet(f)
            if len(df) > 0:
                return df.to_dict(orient="records")
        return []
