"""공공데이터포털(data.go.kr) 및 카카오 로컬 지오코딩 선택적 동기화 CLI.

Pandas/별도 ETL 없이 표준 Python + httpx + pymongo만으로 동작합니다.
DATA_GO_KR_KEY가 설정되지 않은 환경에서는 안전하게 안내 후 종료합니다.
"""

import asyncio
from datetime import UTC, datetime
from xml.etree import ElementTree as ET

import httpx
from pymongo import UpdateOne

from app.core.config import settings
from app.core.db import db_manager

BOKJIRO_LOCAL_URL = "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist"
KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"


async def geocode_address(client: httpx.AsyncClient, address: str) -> dict | None:
    if not settings.kakao_api_key or not address.strip():
        return None
    resp = await client.get(
        KAKAO_ADDRESS_URL,
        headers={"Authorization": f"KakaoAK {settings.kakao_api_key}"},
        params={"query": address},
        timeout=8.0,
    )
    if resp.status_code != 200:
        return None
    docs = resp.json().get("documents") or []
    if not docs:
        return None
    return {
        "type": "Point",
        "coordinates": [float(docs[0]["x"]), float(docs[0]["y"])],
    }


async def sync_bokjiro_local(sido: str = "서울특별시", sigungu: str = "구로구", num_rows: int = 20) -> int:
    if not settings.data_go_kr_key:
        print("[ingest] DATA_GO_KR_KEY가 비어 있어 실데이터 동기화를 건너뜁니다. `make seed`를 사용하세요.")
        return 0

    db = await db_manager.connect()
    synced = 0
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                BOKJIRO_LOCAL_URL,
                params={
                    "serviceKey": settings.data_go_kr_key,
                    "pageNo": 1,
                    "numOfRows": num_rows,
                    "ctpvNm": sido,
                    "sggNm": sigungu,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
            ops: list[UpdateOne] = []
            now = datetime.now(UTC)

            for item in root.findall(".//servList"):
                serv_id = (item.findtext("servId") or "").strip()
                title = (item.findtext("servNm") or "").strip()
                if not serv_id or not title:
                    continue
                summary = (item.findtext("servDgst") or "지자체 복지서비스 안내").strip()
                provider = (item.findtext("bizChrDeptNm") or f"{sido} {sigungu}").strip()
                link = (item.findtext("servDtlLink") or "").strip() or None
                phone = (item.findtext("rprsCtadr") or "").strip() or None

                doc = {
                    "externalId": f"bokjiro-local:{serv_id}",
                    "category": "welfare",
                    "title": title,
                    "summary": summary,
                    "provider": provider,
                    "region": {
                        "sido": sido,
                        "sigungu": sigungu,
                        "dong": None,
                        "admCd": "1153000000" if sigungu == "구로구" else "1100000000",
                        "isNationwide": False,
                    },
                    "address": f"{sido} {sigungu}",
                    "cost": {"type": "subsidy", "amount": 0, "description": "지원 내용 상세 확인"},
                    "schedule": {
                        "days": ["mon", "tue", "wed", "thu", "fri"],
                        "timeSlots": ["weekday_day", "online"],
                        "hoursText": "상시 / 담당 부서 문의",
                    },
                    "deadline": None,
                    "isAlwaysOpen": True,
                    "eligibility": {
                        "minAge": None,
                        "maxAge": None,
                        "targetGroups": ["general"],
                        "incomeMaxPct": None,
                        "requiresVerification": ["상세 지원대상 및 소득 기준 확인 필요"],
                        "requiredDocs": [],
                    },
                    "applyInfo": {
                        "method": "복지로 또는 관할 주민센터 문의",
                        "url": link,
                        "phone": phone,
                    },
                    "source": {"name": "한국사회보장정보원(지자체 복지 API)", "syncedAt": now},
                    "tags": [sigungu, "복지", "지자체"],
                }
                ops.append(
                    UpdateOne(
                        {"externalId": doc["externalId"]},
                        {"$set": doc, "$setOnInsert": {"createdAt": now}},
                        upsert=True,
                    )
                )

            if ops:
                await db["programs"].bulk_write(ops, ordered=False)
                synced = len(ops)
            print(f"[ingest] 복지로 지자체 복지서비스 동기화 완료: {synced}건")
    finally:
        await db_manager.close()
    return synced


if __name__ == "__main__":
    asyncio.run(sync_bokjiro_local())
