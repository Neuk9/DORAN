import pytest

from etl.http import HttpClient


def test_retries_then_raises(monkeypatch):
    calls = {"n": 0}

    def fake_get(*args, **kwargs):
        calls["n"] += 1
        raise RuntimeError("500")

    client = HttpClient(retries=3, backoff_s=0)
    monkeypatch.setattr(client, "_raw_get", fake_get)
    with pytest.raises(RuntimeError):
        client.get_json("http://x", {})
    assert calls["n"] == 3
