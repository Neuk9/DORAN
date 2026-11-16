from fastapi.testclient import TestClient

from app.main import create_app


def test_saved_item_has_ttl_and_no_pii():
    client = TestClient(create_app())
    res = client.post("/api/saved", json={"offering_id": "o1"})
    assert res.status_code == 201
    saved = client.get("/api/saved").json()["data"]
    assert len(saved) == 1
    assert "message" not in saved[0]
