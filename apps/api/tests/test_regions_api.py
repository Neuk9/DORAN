from fastapi.testclient import TestClient

from app.main import create_app


def test_region_search_returns_envelope():
    client = TestClient(create_app())
    res = client.get("/api/regions/search", params={"q": "수성"})
    assert res.status_code == 200
    body = res.json()
    assert {"data", "meta"} <= body.keys()
    assert body["meta"]["source"] == "region"


def test_unknown_gap_returns_404_envelope():
    client = TestClient(create_app())
    res = client.get("/api/regions/0000000000/gap")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "REGION_NOT_FOUND"
