import os
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.db import db_manager
from app.ingest.seed import seed_database
from app.main import app


@pytest.fixture
async def client():
    test_db_name = f"doran_test_{uuid.uuid4().hex[:8]}"
    uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
    db = await db_manager.connect(uri=uri, db_name=test_db_name)
    await seed_database(db)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    if db_manager.client is not None:
        await db_manager.client.drop_database(test_db_name)
    await db_manager.close()


async def test_health_endpoint(client: AsyncClient) -> None:
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["status"] == "ok"
    assert body["data"]["database"] == "connected"


async def test_programs_list_excludes_closed_by_default_and_supports_geo(client: AsyncClient) -> None:
    resp = await client.get("/api/programs")
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) >= 15
    assert all("마감 예시" not in item["title"] for item in items)

    resp_all = await client.get("/api/programs", params={"includeClosed": "true"})
    assert any("마감 예시" in item["title"] for item in resp_all.json()["data"])

    resp_geo = await client.get(
        "/api/programs",
        params={"lat": 37.4852, "lng": 126.8965, "radiusKm": 3.0},
    )
    assert resp_geo.status_code == 200
    geo_items = resp_geo.json()["data"]
    assert len(geo_items) >= 3
    assert all(item["distanceKm"] is not None for item in geo_items)


async def test_chat_recommend_proposal_scenario(client: AsyncClient) -> None:
    query = (
        "서울 구로구에 사는 20대 대학생인데, 주말에 무료로 악기를 배울 수 있는 곳이나 "
        "청년 지원금이 있을까? 연락처는 010-9999-8888"
    )
    resp = await client.post("/api/chat/recommend", json={"message": query, "limit": 6})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["crisis"] is None
    assert "010-9999-8888" not in data["maskedPreview"]
    assert data["profile"]["sigungu"] == "구로구"
    assert "weekend" in data["profile"]["timePreferences"]

    recs = data["recommendations"]
    assert len(recs) >= 3
    titles = [r["program"]["title"] for r in recs]
    assert any("악기" in t or "통기타" in t for t in titles)
    assert any("출처:" in r["explanation"] for r in recs)

    # 차별화 필드 검증: 예상 혜택 합산, 실행 플랜, 제외 사유 투명 공개
    assert data["benefitSummary"]["freeResourceCount"] >= 1
    assert len(data["actionPlan"]) >= 1
    assert data["totalExcludedCount"] >= 1
    assert len(data["excludedPrograms"]) >= 1
    assert any("마감" in " ".join(e["reasons"]) or "연령" in " ".join(e["reasons"]) for e in data["excludedPrograms"])


async def test_chat_recommend_crisis_short_circuits(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/chat/recommend",
        json={"message": "단전 단수되고 너무 절망적이라 자해하고 싶어요"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["crisis"]["detected"] is True
    assert data["provider"] == "safety-rule"
    assert data["recommendations"] == []


async def test_region_report_and_saved_checklist(client: AsyncClient) -> None:
    regions_resp = await client.get("/api/regions")
    assert regions_resp.status_code == 200
    regions = regions_resp.json()["data"]
    assert len(regions) == 8
    # 격차 지수 내림차순 정렬 확인 (가리봉동 최상단)
    assert regions[0]["admCd"] == "1153059500"

    nearest_resp = await client.get("/api/regions/nearest", params={"lat": 37.4825, "lng": 126.889})
    assert nearest_resp.status_code == 200
    nearest_data = nearest_resp.json()["data"]
    assert nearest_data["region"]["admCd"] == "1153059500"
    assert nearest_data["inServiceArea"] is True

    report_resp = await client.get("/api/regions/1153059500/report")
    assert report_resp.status_code == 200
    report = report_resp.json()["data"]
    assert report["region"]["dong"] == "가리봉동"
    assert len(report["insights"]) >= 2
    assert len(report["nearbyRecommended"]) >= 1
    assert len(report["recommendedFacilities"]) >= 2
    assert any("미보유" in f["currentStatus"] for f in report["recommendedFacilities"])
    assert any("어르신" in f["targetDemographic"] or "취약" in f["targetDemographic"] for f in report["recommendedFacilities"])

    # 체크리스트 추가 → 조회 → 삭제
    programs_resp = await client.get("/api/programs", params={"limit": 2})
    prog_id = programs_resp.json()["data"][0]["id"]
    headers = {"X-Session-Id": "session-test-1234"}

    add_resp = await client.post("/api/saved", json={"programId": prog_id}, headers=headers)
    assert add_resp.status_code == 200
    assert len(add_resp.json()["data"]["items"]) == 1

    del_resp = await client.delete(f"/api/saved/{prog_id}", headers=headers)
    assert del_resp.status_code == 200
    assert len(del_resp.json()["data"]["items"]) == 0
