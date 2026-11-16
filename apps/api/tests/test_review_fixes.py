from fastapi.testclient import TestClient

from app.main import create_app

SOURCE_UUID_LEAK = "출처: 출처"


def test_recommend_excludes_child_programs_for_senior():
    client = TestClient(create_app())
    res = client.post("/api/recommend", json={"adm_cd": "2711053000", "age_years": 68})
    items = res.json()["data"]
    assert items
    for item in items:
        if item.get("target_age_max") is not None:
            assert item["target_age_max"] >= 68


def test_recommend_items_carry_source_and_captured_at():
    client = TestClient(create_app())
    res = client.post("/api/recommend", json={"adm_cd": "2711053000", "age_years": 68})
    first = res.json()["data"][0]
    assert first["source"]
    assert first["source"] != "seed-uuid"
    assert first["captured_at"]


def test_recommend_computes_distance_when_coordinates_given():
    client = TestClient(create_app())
    res = client.post(
        "/api/recommend",
        json={
            "adm_cd": "2711053000",
            "age_years": 68,
            "lat": 35.84,
            "lng": 128.62,
        },
    )
    distances = [i["distance_km"] for i in res.json()["data"]]
    assert any(d is not None for d in distances)


def test_chat_cards_do_not_fabricate_source(monkeypatch):
    import app.routers.chat as chat_router
    from app.schemas import SlotExtraction

    async def fake_slots(message, llm, previous=None):
        return SlotExtraction(region_adm_cd="2711053000", age_years=68, missing_slots=[])

    monkeypatch.setattr(chat_router, "extract_slots", fake_slots)
    client = TestClient(create_app())
    res = client.post("/api/chat", json={"message": "혼자 사는 68살"})
    assert SOURCE_UUID_LEAK not in res.text
    assert "seed" in res.text
