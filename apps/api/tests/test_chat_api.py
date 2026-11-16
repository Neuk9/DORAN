from fastapi.testclient import TestClient

from app.main import create_app


def test_chat_timeout_returns_fallback_event_not_500(monkeypatch):
    import app.routers.chat as chat_router
    from app.services.llm.base import LLMTimeout

    async def boom(*args, **kwargs):
        raise LLMTimeout("timeout")

    monkeypatch.setattr(chat_router, "extract_slots", boom)
    client = TestClient(create_app())
    res = client.post("/api/chat", json={"message": "아이 돌봄 알려줘"})
    assert res.status_code == 200
    assert "fallback" in res.text


def test_chat_returns_cards_with_source(monkeypatch):
    import app.routers.chat as chat_router
    from app.schemas import SlotExtraction

    async def fake_slots(message, llm, previous=None):
        return SlotExtraction(region_adm_cd="2711053000", age_years=8, missing_slots=[])

    monkeypatch.setattr(chat_router, "extract_slots", fake_slots)
    client = TestClient(create_app())
    res = client.post("/api/chat", json={"message": "초1 아이 돌봄"})
    assert res.status_code == 200
    assert "cards" in res.text
    assert '"source": "seed"' in res.text
    assert "출처: 출처" not in res.text


def test_crisis_message_returns_crisis_event_without_calling_llm(monkeypatch):
    import app.routers.chat as chat_router

    called = {"n": 0}

    async def boom(*args, **kwargs):
        called["n"] += 1
        raise AssertionError("LLM must not be called for crisis messages")

    monkeypatch.setattr(chat_router, "extract_slots", boom)
    client = TestClient(create_app())
    res = client.post("/api/chat", json={"message": "죽고 싶어요"})
    assert res.status_code == 200
    assert "crisis" in res.text
    assert "129" in res.text
    assert called["n"] == 0
