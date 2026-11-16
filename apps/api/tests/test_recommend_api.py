from fastapi.testclient import TestClient

from app.main import create_app


def test_recommend_returns_scored_items_with_meta():
    client = TestClient(create_app())
    res = client.post("/api/recommend", json={"adm_cd": "2711053000", "budget_krw": 30000})
    assert res.status_code == 200
    body = res.json()
    assert "data" in body and "meta" in body
    if body["data"]:
        item = body["data"][0]
        assert {"offering_id", "score", "reasons", "eligibility_state"} <= item.keys()
