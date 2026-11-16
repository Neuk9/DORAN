from datetime import UTC, datetime

from etl.snapshot import SnapshotStore


def test_empty_response_is_recorded_not_raised(tmp_path):
    store = SnapshotStore(tmp_path)
    result = store.write("ssis_local", [], datetime(2026, 11, 17, tzinfo=UTC))
    assert result.status == "empty"
    assert result.row_count == 0
    assert store.read_latest("ssis_local") == []


def test_latest_returns_last_non_empty(tmp_path):
    store = SnapshotStore(tmp_path)
    store.write("ssis_local", [{"id": "1"}], datetime(2026, 11, 16, tzinfo=UTC))
    store.write("ssis_local", [], datetime(2026, 11, 17, tzinfo=UTC))
    assert store.read_latest("ssis_local") == [{"id": "1"}]
