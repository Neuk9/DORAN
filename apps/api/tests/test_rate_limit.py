from fastapi.testclient import TestClient

from app.main import create_app


def test_rate_limit_returns_429():
    client = TestClient(create_app())
    codes = [client.get("/api/health").status_code for _ in range(25)]
    assert 429 in codes
