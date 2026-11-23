"""공공데이터포털(data.go.kr) 9종 오픈API + 카카오 로컬 실데이터 동기화 및 동적 격차 산출 모듈.

연동 API:
1. 행정안전부_행정동별(통반단위) 성/연령별 주민등록 인구수 (15108072)
2. 행정안전부_법정동별(행정동 통반단위) 주민등록 인구 및 세대현황 (15108071)
3. 한국사회보장정보원_지자체복지서비스 (LcgvWelfarelist)
4. 한국사회보장정보원_중앙부처복지서비스 (15090532)
5. 한국사회보장정보원_사회복지시설정보서비스 현황 (sclWlfrFcltInfoInqirService2)
6. 행정안전부_전국도서관표준데이터 (tn_pubr_public_lbrry_api)
7. 국가평생교육진흥원_K-MOOC 강좌정보 (15042355)
8. 한국문화정보원_전국문화기반시설총람 (15125097)
9. 한국문화예술교육진흥원_문화예술교육 자원지도 (15140200)
10. 카카오 로컬 API (주소 지오코딩 · 행정동 역지오코딩 · 생활권 문화/교육 시설 조회)
"""

import asyncio
import logging
import re
from datetime import UTC, datetime, timedelta, timezone
from urllib.parse import unquote
from xml.etree import ElementTree as ET

import httpx
from pymongo import UpdateOne
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.core.db import db_manager
from app.services.gap import compute_region_scores

logger = logging.getLogger(__name__)
KST = timezone(timedelta(hours=9))

MOIS_POP_URL = "https://apis.data.go.kr/1741000/admmSexdAgePpltn/selectAdmmSexdAgePpltn"
MOIS_HOUSEHOLD_URL = "https://apis.data.go.kr/1741000/stdgPpltnHhStus/selectStdgPpltnHhStus"
BOKJIRO_LOCAL_URL = "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist"
BOKJIRO_CENTRAL_URL = "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001"
WELFARE_FCLT_LIST_URL = "https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService2/getFcltListInfoInqire2"
WELFARE_FCLT_DETAIL_URL = "https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService2/getFcltByBassInfoInqire2"
LIBRARY_STD_URL = "https://api.data.go.kr/openapi/tn_pubr_public_lbrry_api"
KMOOC_LIST_URL = "https://apis.data.go.kr/B552881/kmooc_v2_0/courseList_v2_0"
CULTURE_FCLT_BASE_URL = "https://apis.data.go.kr/B553457/rgnCltrFcltExmnv1"
ARTE_PROGRAM_URL = "https://apis.data.go.kr/B551463/arteApiService/getProgramInfo"

KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
KAKAO_COORD2REGION_URL = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json"

# (시도명, 시군구명, 시군구코드 10자리, 대표 행정동코드 10자리, 대표 법정동코드 10자리)
DEFAULT_TARGET_GUS: list[tuple[str, str, str, str, str]] = [
    ("서울특별시", "구로구", "1153000000", "1153054000", "1153010200"),
    ("서울특별시", "금천구", "1154500000", "1154551000", "1154510100"),
]

# 동시 동기화 중복 실행 방지 락
_sync_lock = asyncio.Lock()


def _normalize_dong_name(raw_dong: str) -> str:
    """'구로제3동' -> '구로3동' 형태로 일상 행정동명 정규화."""
    cleaned = raw_dong.strip()
    return re.sub(r"제(\d+동)$", r"\1", cleaned)


def _safe_int(val: object) -> int:
    try:
        return int(str(val or "0").replace(",", "").strip())
    except (ValueError, TypeError):
        return 0


def _recent_year_months() -> list[str]:
    """현재(KST) 기준 최근 4개월 YYYYMM 후보 생성 (직전 월 우선)."""
    now = datetime.now(KST)
    y, m = now.year, now.month
    yms: list[str] = []
    for _ in range(4):
        m -= 1
        if m <= 0:
            m = 12
            y -= 1
        yms.append(f"{y:04d}{m:02d}")
    return yms


def _kakao_headers() -> dict[str, str]:
    return {"Authorization": f"KakaoAK {settings.kakao_api_key.strip()}"}


async def kakao_geocode(
    client: httpx.AsyncClient,
    query: str,
) -> tuple[float, float, str | None, str | None] | None:
    """주소 또는 시설명 -> (lng, lat, admCd, dong) 반환."""
    if not settings.kakao_api_key or not query.strip():
        return None
    try:
        resp = await client.get(
            KAKAO_ADDRESS_URL,
            headers=_kakao_headers(),
            params={"query": query.strip()},
            timeout=6.0,
        )
        if resp.status_code == 200:
            docs = resp.json().get("documents") or []
            if docs:
                doc = docs[0]
                lng, lat = float(doc["x"]), float(doc["y"])
                addr = doc.get("address") or {}
                h_code = (addr.get("h_code") or "").strip() or None
                dong = (addr.get("region_3depth_h_name") or addr.get("region_3depth_name") or "").strip() or None
                return lng, lat, h_code, dong
    except Exception:
        pass

    # 주소 검색 실패 시 키워드 검색 폴백 (예: '구로3동 주민센터')
    try:
        resp = await client.get(
            KAKAO_KEYWORD_URL,
            headers=_kakao_headers(),
            params={"query": query.strip(), "size": 1},
            timeout=6.0,
        )
        if resp.status_code == 200:
            docs = resp.json().get("documents") or []
            if docs:
                lng, lat = float(docs[0]["x"]), float(docs[0]["y"])
                adm_cd, dong = await kakao_coord_to_adm(client, lng, lat)
                return lng, lat, adm_cd, dong
    except Exception:
        pass
    return None


async def kakao_coord_to_adm(
    client: httpx.AsyncClient,
    lng: float,
    lat: float,
) -> tuple[str | None, str | None]:
    """(lng, lat) -> (행정동 10자리 코드, 행정동명)."""
    if not settings.kakao_api_key:
        return None, None
    try:
        resp = await client.get(
            KAKAO_COORD2REGION_URL,
            headers=_kakao_headers(),
            params={"x": lng, "y": lat},
            timeout=5.0,
        )
        if resp.status_code != 200:
            return None, None
        docs = resp.json().get("documents") or []
        h_doc = next((d for d in docs if d.get("region_type") == "H"), None) or (docs[0] if docs else None)
        if not h_doc:
            return None, None
        return (h_doc.get("code") or "").strip() or None, (h_doc.get("region_3depth_name") or "").strip() or None
    except Exception:
        return None, None


async def fetch_mois_gu_populations(
    client: httpx.AsyncClient,
    api_key: str,
    sido: str,
    sigungu: str,
    seed_admm_cd: str,
) -> tuple[str | None, list[dict]]:
    """행정안전부 오픈API(15108072)로 자치구 내 모든 행정동의 최신 연령별 주민등록 인구 조회."""
    for ym in _recent_year_months():
        try:
            resp = await client.get(
                MOIS_POP_URL,
                params={
                    "serviceKey": api_key,
                    "admmCd": seed_admm_cd,
                    "srchFrYm": ym,
                    "srchToYm": ym,
                    "lv": "3",
                    "regSeCd": "1",
                    "type": "json",
                    "numOfRows": 50,
                    "pageNo": 1,
                },
                timeout=30.0,
            )
            if resp.status_code != 200:
                continue
            payload = resp.json().get("Response") or {}
            head = payload.get("head") or {}
            if str(head.get("resultCode")) != "0":
                continue
            raw_items = (payload.get("items") or {}).get("item") or []
            if isinstance(raw_items, dict):
                raw_items = [raw_items]
            if not raw_items:
                continue

            dongs: list[dict] = []
            for item in raw_items:
                adm_cd = str(item.get("admmCd") or "").strip()
                dong_nm = _normalize_dong_name(str(item.get("dongNm") or ""))
                total = _safe_int(item.get("totNmprCnt"))
                if not adm_cd or not dong_nm or total <= 0:
                    continue

                age_0_19 = (
                    _safe_int(item.get("male0AgeNmprCnt"))
                    + _safe_int(item.get("feml0AgeNmprCnt"))
                    + _safe_int(item.get("male10AgeNmprCnt"))
                    + _safe_int(item.get("feml10AgeNmprCnt"))
                )
                youth = (
                    _safe_int(item.get("male20AgeNmprCnt"))
                    + _safe_int(item.get("feml20AgeNmprCnt"))
                    + _safe_int(item.get("male30AgeNmprCnt"))
                    + _safe_int(item.get("feml30AgeNmprCnt"))
                )
                age_60s = _safe_int(item.get("male60AgeNmprCnt")) + _safe_int(item.get("feml60AgeNmprCnt"))
                age_70plus = (
                    _safe_int(item.get("male70AgeNmprCnt"))
                    + _safe_int(item.get("feml70AgeNmprCnt"))
                    + _safe_int(item.get("male80AgeNmprCnt"))
                    + _safe_int(item.get("feml80AgeNmprCnt"))
                    + _safe_int(item.get("male90AgeNmprCnt"))
                    + _safe_int(item.get("feml90AgeNmprCnt"))
                    + _safe_int(item.get("male100AgeNmprCnt"))
                    + _safe_int(item.get("feml100AgeNmprCnt"))
                )
                # 행안부 10세 단위 제공: 65세+ = 60대 절반 + 70세 이상
                senior = round(age_60s * 0.5) + age_70plus
                # 초고령(70+) + 후기고령(65~69) + 아동·청소년 부양 비중 기반 취약 추정치
                vulnerable_ratio = round(
                    min(
                        0.45,
                        (age_70plus / total) * 1.15
                        + (age_60s * 0.5 / total) * 0.40
                        + (age_0_19 / total) * 0.10,
                    ),
                    4,
                )

                dongs.append(
                    {
                        "admCd": adm_cd,
                        "sido": sido,
                        "sigungu": sigungu,
                        "dong": dong_nm,
                        "population": {
                            "total": total,
                            "youth": youth,
                            "senior": senior,
                            "vulnerableRatio": vulnerable_ratio,
                        },
                        "statsYm": str(item.get("statsYm") or ym),
                    }
                )
            if dongs:
                return str(dongs[0]["statsYm"]), dongs
        except Exception as exc:
            logger.warning("[sync_public] MOIS population fetch failed (%s %s): %s", sigungu, ym, exc)
    return None, []


def _parse_bokjiro_targets(life_array: str, thema_array: str) -> tuple[list[str], int | None, int | None, str]:
    groups: list[str] = []
    min_age: int | None = None
    max_age: int | None = None
    if "노년" in life_array:
        groups.append("senior")
        min_age = 65
    if "청년" in life_array:
        groups.append("youth")
        if min_age is None:
            min_age = 19
        max_age = 39
    if any(k in life_array for k in ("영유아", "아동", "청소년", "임신")):
        groups.append("family")
    if any(k in thema_array for k in ("서민금융", "생활지원", "주거", "저소득")):
        groups.append("low_income")
    if not groups:
        groups.append("general")

    category = "welfare"
    if "교육" in thema_array:
        category = "education"
    elif any(k in thema_array for k in ("문화", "여가")):
        category = "culture"
    return list(dict.fromkeys(groups)), min_age, max_age, category


async def sync_bokjiro_local(
    client: httpx.AsyncClient,
    db: AsyncDatabase,
    api_key: str,
    sido: str,
    sigungu: str,
    sgg_cd: str,
) -> int:
    """한국사회보장정보원 지자체복지서비스 API 동기화 (일시 타임아웃 시 1회 재시도)."""
    root = None
    for attempt in range(2):
        try:
            resp = await client.get(
                BOKJIRO_LOCAL_URL,
                params={
                    "serviceKey": api_key,
                    "pageNo": 1,
                    "numOfRows": 50,
                    "ctpvNm": sido,
                    "sggNm": sigungu,
                },
                timeout=30.0,
            )
            if resp.status_code == 200:
                root = ET.fromstring(resp.text)
                break
        except Exception as exc:
            if attempt == 1:
                logger.warning("[sync_public] Bokjiro fetch failed (%s): %s", sigungu, exc)
            else:
                await asyncio.sleep(1.0)
    if root is None:
        return 0

    now = datetime.now(UTC)
    ops: list[UpdateOne] = []
    for item in root.findall(".//servList"):
        serv_id = (item.findtext("servId") or "").strip()
        title = (item.findtext("servNm") or "").strip()
        if not serv_id or not title:
            continue
        summary = (item.findtext("servDgst") or "지자체 복지서비스 안내").strip()
        provider = (item.findtext("bizChrDeptNm") or f"{sido} {sigungu}").strip()
        link = (item.findtext("servDtlLink") or "").strip() or None
        phone = (item.findtext("rprsCtadr") or "").strip() or None
        life_array = (item.findtext("lifeNmArray") or "").strip()
        thema_array = (item.findtext("intrsThemaNmArray") or "").strip()
        apply_method = (item.findtext("aplyMtdNm") or "방문 또는 복지로 신청").strip()

        target_groups, min_age, max_age, category = _parse_bokjiro_targets(life_array, thema_array)
        tags = [sigungu, "복지로", "지자체"]
        for tok in (life_array + "," + thema_array).split(","):
            t = tok.strip()
            if t and t not in tags:
                tags.append(t)

        doc = {
            "externalId": f"bokjiro-local:{serv_id}",
            "category": category,
            "title": title,
            "summary": summary,
            "provider": provider,
            "region": {
                "sido": sido,
                "sigungu": sigungu,
                "dong": None,
                "admCd": sgg_cd,
                "isNationwide": False,
            },
            "address": f"{sido} {sigungu}",
            "cost": {"type": "subsidy", "amount": 0, "description": "지자체 지원 (상세 기준 확인)"},
            "schedule": {
                "days": ["mon", "tue", "wed", "thu", "fri"],
                "timeSlots": ["weekday_day", "online"],
                "hoursText": "평일 09:00~18:00 / 관할 주민센터 문의",
            },
            "deadline": None,
            "isAlwaysOpen": True,
            "eligibility": {
                "minAge": min_age,
                "maxAge": max_age,
                "targetGroups": target_groups,
                "incomeMaxPct": None,
                "requiresVerification": ["지자체 거주 기간 및 상세 소득·자격 기준 확인 필요"],
                "requiredDocs": ["신분증", "주민등록등본"],
            },
            "applyInfo": {
                "method": f"{apply_method} (관할 동 주민센터 또는 복지로)",
                "url": link,
                "phone": phone,
            },
            "source": {"name": "한국사회보장정보원(지자체복지서비스 API)", "syncedAt": now},
            "tags": tags[:8],
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
    return len(ops)


def _welfare_kind_profile(kind_nm: str) -> tuple[list[str], int | None, list[str]]:
    if "노인" in kind_nm:
        return ["senior"], 65, ["노인", "어르신", "돌봄", "복지관"]
    if any(k in kind_nm for k in ("아동", "돌봄", "가족", "다문화", "한부모")):
        return ["family"], None, ["아동", "돌봄", "가족"]
    if any(k in kind_nm for k in ("장애", "정신", "노숙")):
        return ["low_income"], None, ["취약계층", "돌봄", "복지"]
    return ["general"], None, ["복지", "복지관"]


async def sync_welfare_facilities(
    client: httpx.AsyncClient,
    db: AsyncDatabase,
    api_key: str,
    sido: str,
    sigungu: str,
    sgg_cd: str,
    max_details: int = 35,
) -> int:
    """한국사회보장정보원 사회복지시설정보서비스 API로 실제 복지시설 수집 및 지오코딩."""
    priority_kinds = (
        "노인여가복지시설",
        "노인의료복지시설",
        "재가노인복지시설",
        "다함께돌봄센터",
        "아동복지시설",
        "장애인지역사회재활시설",
        "건강가정지원센터",
        "다문화가족복지시설",
        "사회복지관",
    )
    items: list[dict] = []
    for page in (1, 2, 3):
        try:
            resp = await client.get(
                WELFARE_FCLT_LIST_URL,
                params={
                    "serviceKey": api_key,
                    "pageNo": page,
                    "numOfRows": 100,
                    "jrsdSggCd": sgg_cd,
                },
                timeout=15.0,
            )
            if resp.status_code != 200:
                break
            root = ET.fromstring(resp.text)
            page_items = root.findall(".//item")
            if not page_items:
                break
            for el in page_items:
                name = (el.findtext("fcltNm") or "").strip()
                fclt_cd = (el.findtext("fcltCd") or "").strip()
                srv_inst_id = (el.findtext("srvInstId") or "").strip()
                kind_nm = (el.findtext("fcltKindNm") or "").strip()
                if not fclt_cd or not name or "*" in name:
                    continue
                items.append(
                    {
                        "fcltCd": fclt_cd,
                        "srvInstId": srv_inst_id,
                        "name": name,
                        "kindNm": kind_nm,
                    }
                )
            total_cnt = _safe_int(root.findtext(".//totalCount"))
            if page * 100 >= total_cnt:
                break
        except Exception as exc:
            logger.warning("[sync_public] Welfare facility list failed (%s p%d): %s", sigungu, page, exc)
            break

    # 다양한 시설 유형이 고르게 포함되도록 우선순위 정렬 후 최대 max_details건 상세조회
    def _sort_key(row: dict) -> tuple[int, str]:
        kind = row["kindNm"]
        rank = priority_kinds.index(kind) if kind in priority_kinds else len(priority_kinds)
        return (rank, row["name"])

    items.sort(key=_sort_key)
    selected: list[dict] = []
    per_kind_cap: dict[str, int] = {}
    for row in items:
        k = row["kindNm"]
        if per_kind_cap.get(k, 0) >= 8:
            continue
        per_kind_cap[k] = per_kind_cap.get(k, 0) + 1
        selected.append(row)
        if len(selected) >= max_details:
            break

    sem = asyncio.Semaphore(6)
    now = datetime.now(UTC)

    async def _resolve_via_kakao(row: dict) -> UpdateOne | None:
        async with sem:
            try:
                # 사회복지시설 상세 API의 초당 호출 제한(429)을 회피하고 정확한 좌표·전화·주소를 얻기 위해
                # 한국사회보장정보원 공식 시설목록(fcltNm)을 카카오 로컬 키워드 API로 매칭합니다.
                resp = await client.get(
                    KAKAO_KEYWORD_URL,
                    headers=_kakao_headers(),
                    params={"query": f"{sigungu} {row['name']}", "size": 1},
                    timeout=6.0,
                )
                if resp.status_code != 200:
                    return None
                docs = resp.json().get("documents") or []
                if not docs:
                    return None
                place = docs[0]
                lng, lat = float(place["x"]), float(place["y"])
                adm_cd, dong = await kakao_coord_to_adm(client, lng, lat)
                full_addr = (place.get("road_address_name") or place.get("address_name") or f"{sido} {sigungu}").strip()
                phone = (place.get("phone") or "").strip() or None
                homepage = (place.get("place_url") or "").strip() or None
                target_groups, min_age, extra_tags = _welfare_kind_profile(row["kindNm"])

                doc = {
                    "externalId": f"welfare-fclt:{row['fcltCd']}",
                    "category": "welfare",
                    "title": row["name"],
                    "summary": f"{sigungu} 공식 등록 {row['kindNm']}입니다. 이용 대상·프로그램 및 상담 일정은 기관으로 문의해 주세요.",
                    "provider": f"{sigungu} · {row['kindNm']}",
                    "region": {
                        "sido": sido,
                        "sigungu": sigungu,
                        "dong": _normalize_dong_name(dong) if dong else None,
                        "admCd": adm_cd or sgg_cd,
                        "isNationwide": False,
                    },
                    "location": {"type": "Point", "coordinates": [lng, lat]},
                    "address": full_addr,
                    "cost": {"type": "free", "amount": 0, "description": "공공 복지시설 (이용 조건 기관 문의)"},
                    "schedule": {
                        "days": ["mon", "tue", "wed", "thu", "fri"],
                        "timeSlots": ["weekday_day"],
                        "hoursText": "평일 09:00~18:00 (시설별 상이)",
                    },
                    "deadline": None,
                    "isAlwaysOpen": True,
                    "eligibility": {
                        "minAge": min_age,
                        "maxAge": None,
                        "targetGroups": target_groups,
                        "incomeMaxPct": None,
                        "requiresVerification": ["시설별 이용 자격 및 대기 여부 사전 확인"],
                        "requiredDocs": ["신분증"],
                    },
                    "applyInfo": {
                        "method": "전화 또는 방문 상담",
                        "url": homepage,
                        "phone": phone,
                    },
                    "source": {"name": "한국사회보장정보원(사회복지시설정보 API)", "syncedAt": now},
                    "tags": list(dict.fromkeys([sigungu, row["kindNm"], *extra_tags]))[:8],
                }
                return UpdateOne(
                    {"externalId": doc["externalId"]},
                    {"$set": doc, "$setOnInsert": {"createdAt": now}},
                    upsert=True,
                )
            except Exception:
                return None

    results = await asyncio.gather(*(_resolve_via_kakao(r) for r in selected))
    ops = [op for op in results if op is not None]
    if ops:
        await db["programs"].bulk_write(ops, ordered=False)
    return len(ops)


async def sync_public_libraries(
    client: httpx.AsyncClient,
    db: AsyncDatabase,
    api_key: str,
    sido: str,
    sigungu: str,
    sgg_cd: str,
) -> int:
    """전국도서관표준데이터 오픈API로 공공도서관 실데이터 동기화."""
    try:
        resp = await client.get(
            LIBRARY_STD_URL,
            params={
                "serviceKey": api_key,
                "pageNo": 1,
                "numOfRows": 100,
                "type": "json",
                "CTPRVN_NM": sido,
                "SIGNGU_NM": sigungu,
            },
            timeout=20.0,
        )
        if resp.status_code != 200:
            return 0
        body = resp.json().get("body") or {}
        items = (body.get("items") or {}).get("item") or []
        if isinstance(items, dict):
            items = [items]
    except Exception as exc:
        logger.warning("[sync_public] Library API failed (%s): %s", sigungu, exc)
        return 0

    sem = asyncio.Semaphore(8)
    now = datetime.now(UTC)

    async def _build_lib_op(item: dict) -> UpdateOne | None:
        name = (item.get("lbrryNm") or "").strip()
        if not name:
            return None
        try:
            lat = float(item.get("latitude") or 0)
            lng = float(item.get("longitude") or 0)
        except (ValueError, TypeError):
            lat, lng = 0.0, 0.0

        async with sem:
            adm_cd, dong = (None, None)
            if lat and lng:
                adm_cd, dong = await kakao_coord_to_adm(client, lng, lat)
            elif item.get("rdnmadr"):
                geo = await kakao_geocode(client, str(item["rdnmadr"]))
                if geo:
                    lng, lat, adm_cd, dong = geo

        weekday_open = (item.get("weekdayOperOpenHhmm") or "09:00").strip()
        weekday_close = (item.get("weekdayOperColseHhmm") or "18:00").strip()
        sat_open = (item.get("satOperOperOpenHhmm") or "").strip()
        sat_close = (item.get("satOperCloseHhmm") or "").strip()
        close_day = (item.get("closeDay") or "법정공휴일").strip()
        book_co = _safe_int(item.get("bookCo"))
        seat_co = _safe_int(item.get("seatCo"))

        time_slots = ["weekday_day"]
        if weekday_close >= "20:00":
            time_slots.append("weekday_evening")
        days = ["mon", "tue", "wed", "thu", "fri"]
        if sat_open and sat_open != "00:00":
            time_slots.append("weekend")
            days.append("sat")

        hours_text = f"평일 {weekday_open}~{weekday_close}"
        if sat_open and sat_open != "00:00":
            hours_text += f" / 토 {sat_open}~{sat_close}"
        hours_text += f" (휴관: {close_day})"

        is_children = "어린이" in name
        category = "culture" if is_children else "education"
        target_groups = ["family"] if is_children else ["general", "youth", "senior"]
        tags = [sigungu, "도서관", "평생학습", "독서", "문화"]
        if is_children:
            tags.extend(["어린이", "아동", "가족"])

        homepage = (item.get("homepageUrl") or "").strip() or None
        if homepage and not homepage.startswith(("http://", "https://")):
            homepage = f"https://{homepage}"

        doc: dict = {
            "externalId": f"public-lib:{item.get('insttCode') or sgg_cd}:{name}",
            "category": category,
            "title": name,
            "summary": (
                f"{sigungu} {item.get('lbrrySe') or '공공도서관'} (장서 {book_co:,}권 · 열람석 {seat_co:,}석). "
                "무료 도서 대출, 열람실, 독서·평생학습 프로그램을 이용할 수 있습니다."
            ),
            "provider": (item.get("operInstitutionNm") or f"{sido} {sigungu}").strip(),
            "region": {
                "sido": sido,
                "sigungu": sigungu,
                "dong": _normalize_dong_name(dong) if dong else None,
                "admCd": adm_cd or sgg_cd,
                "isNationwide": False,
            },
            "address": (item.get("rdnmadr") or f"{sido} {sigungu}").strip(),
            "cost": {"type": "free", "amount": 0, "description": "무료 이용 (회원증 발급)"},
            "schedule": {
                "days": days,
                "timeSlots": time_slots,
                "hoursText": hours_text,
            },
            "deadline": None,
            "isAlwaysOpen": True,
            "eligibility": {
                "minAge": None,
                "maxAge": None,
                "targetGroups": target_groups,
                "incomeMaxPct": None,
                "requiresVerification": [],
                "requiredDocs": ["신분증(도서 대출 회원증 발급 시)"],
            },
            "applyInfo": {
                "method": "방문 이용 또는 도서관 홈페이지 신청",
                "url": homepage,
                "phone": (item.get("phoneNumber") or "").strip() or None,
            },
            "source": {"name": "행정안전부(전국도서관표준데이터 API)", "syncedAt": now},
            "tags": list(dict.fromkeys(tags))[:8],
        }
        if lat and lng:
            doc["location"] = {"type": "Point", "coordinates": [lng, lat]}
        return UpdateOne(
            {"externalId": doc["externalId"]},
            {"$set": doc, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        )

    ops = [op for op in await asyncio.gather(*(_build_lib_op(it) for it in items)) if op is not None]
    if ops:
        await db["programs"].bulk_write(ops, ordered=False)
    return len(ops)


async def sync_kakao_community_facilities_for_dong(
    client: httpx.AsyncClient,
    db: AsyncDatabase,
    dong_doc: dict,
) -> dict[str, int]:
    """카카오 로컬 API로 행정동 중심 반경 1.2km 내 실제 공공 문화·교육·어르신 시설 조회 및 DB 반영."""
    if not settings.kakao_api_key:
        return {"welfare": 0, "education": 0, "culture": 0}

    lng, lat = dong_doc["center"]["coordinates"]
    adm_cd = dong_doc["admCd"]
    sido = dong_doc["sido"]
    sigungu = dong_doc["sigungu"]
    dong = dong_doc["dong"]

    queries: list[tuple[str, str, list[str]]] = [
        ("노인복지관", "welfare", ["senior"]),
        ("사회복지관", "welfare", ["general", "low_income"]),
        ("평생학습관", "education", ["general", "senior", "youth"]),
        ("청년공간", "education", ["youth"]),
        ("문화센터", "culture", ["general", "family"]),
        ("생활문화센터", "culture", ["general", "youth"]),
    ]
    now = datetime.now(UTC)
    ops: list[UpdateOne] = []
    seen_ids: set[str] = set()

    for q, cat, targets in queries:
        try:
            resp = await client.get(
                KAKAO_KEYWORD_URL,
                headers=_kakao_headers(),
                params={"query": q, "x": lng, "y": lat, "radius": 1200, "size": 5, "sort": "distance"},
                timeout=6.0,
            )
            if resp.status_code != 200:
                continue
            for item in resp.json().get("documents") or []:
                pid = str(item.get("id") or "").strip()
                pname = str(item.get("place_name") or "").strip()
                cat_name = str(item.get("category_name") or "")
                # 사설 학원·상업시설 제외 (공공·복지·문화·교육기관 우선)
                if not pid or not pname or pid in seen_ids:
                    continue
                if any(priv in cat_name for priv in ("음식점", "카페", "부동산", "병원", "의원", "약국", "마트")):
                    continue
                seen_ids.add(pid)
                plng, plat = float(item["x"]), float(item["y"])
                p_adm, p_dong = await kakao_coord_to_adm(client, plng, plat)
                doc = {
                    "externalId": f"kakao-live:{pid}",
                    "category": cat,
                    "title": pname,
                    "summary": f"{sigungu} 생활권 실제 공공·지역 시설 ({cat_name.split('>')[-1].strip() or q}).",
                    "provider": cat_name.split(">")[-1].strip() or f"{sigungu} 지역 시설",
                    "region": {
                        "sido": sido,
                        "sigungu": sigungu,
                        "dong": _normalize_dong_name(p_dong) if p_dong else dong,
                        "admCd": p_adm or adm_cd,
                        "isNationwide": False,
                    },
                    "location": {"type": "Point", "coordinates": [plng, plat]},
                    "address": item.get("road_address_name") or item.get("address_name") or f"{sido} {sigungu}",
                    "cost": {"type": "free", "amount": 0, "description": "무료 또는 공공 요금 (기관 문의)"},
                    "schedule": {
                        "days": ["mon", "tue", "wed", "thu", "fri", "sat"],
                        "timeSlots": ["weekday_day", "weekend"],
                        "hoursText": "운영시간 기관 문의",
                    },
                    "deadline": None,
                    "isAlwaysOpen": True,
                    "eligibility": {
                        "minAge": 65 if q == "노인복지관" else (19 if q == "청년공간" else None),
                        "maxAge": 39 if q == "청년공간" else None,
                        "targetGroups": targets,
                        "incomeMaxPct": None,
                        "requiresVerification": [],
                        "requiredDocs": [],
                    },
                    "applyInfo": {
                        "method": "방문 또는 전화 문의",
                        "url": item.get("place_url") or None,
                        "phone": item.get("phone") or None,
                    },
                    "source": {"name": "카카오 로컬 장소 API(실시간)", "syncedAt": now},
                    "tags": list(dict.fromkeys([sigungu, dong, q, cat])),
                }
                ops.append(
                    UpdateOne(
                        {"externalId": doc["externalId"]},
                        {"$set": doc, "$setOnInsert": {"createdAt": now}},
                        upsert=True,
                    )
                )
        except Exception:
            continue

    if ops:
        await db["programs"].bulk_write(ops, ordered=False)
    return {"upserted": len(ops)}


async def fetch_mois_gu_households(
    client: httpx.AsyncClient,
    api_key: str,
    seed_stdg_cd: str,
    ym: str | None = None,
) -> dict[str, float]:
    """행정안전부 주민등록 인구 및 세대현황(15108071)으로 법정동별 세대당 인구수(1인가구 밀도 지표) 조회."""
    candidate_yms = [ym] if ym else _recent_year_months()
    for target_ym in candidate_yms:
        if not target_ym:
            continue
        try:
            resp = await client.get(
                MOIS_HOUSEHOLD_URL,
                params={
                    "serviceKey": api_key,
                    "stdgCd": seed_stdg_cd,
                    "srchFrYm": target_ym,
                    "srchToYm": target_ym,
                    "lv": "3",
                    "regSeCd": "1",
                    "type": "json",
                    "numOfRows": 50,
                    "pageNo": 1,
                },
                timeout=25.0,
            )
            if resp.status_code != 200:
                continue
            payload = resp.json().get("Response") or {}
            if str((payload.get("head") or {}).get("resultCode")) != "0":
                continue
            items = (payload.get("items") or {}).get("item") or []
            if isinstance(items, dict):
                items = [items]
            out: dict[str, float] = {}
            for item in items:
                stdg_nm = str(item.get("stdgNm") or "").strip()
                try:
                    hh_nmpr = float(item.get("hhNmpr") or 0)
                except (ValueError, TypeError):
                    hh_nmpr = 0.0
                if stdg_nm and hh_nmpr > 0:
                    out[stdg_nm] = hh_nmpr
            if out:
                return out
        except Exception as exc:
            logger.warning("[sync_public] MOIS household fetch failed (%s): %s", seed_stdg_cd, exc)
    return {}


async def sync_bokjiro_central(
    client: httpx.AsyncClient,
    db: AsyncDatabase,
    api_key: str,
) -> int:
    """한국사회보장정보원 중앙부처복지서비스 API(15090532)로 전국 핵심 복지사업 동기화."""
    keywords = ("청년", "노인", "저소득", "아이돌봄", "에너지", "문화누리")
    now = datetime.now(UTC)
    seen_ids: set[str] = set()
    ops: list[UpdateOne] = []

    async def _fetch_kw(kw: str) -> list[ET.Element]:
        for attempt in range(2):
            try:
                resp = await client.get(
                    BOKJIRO_CENTRAL_URL,
                    params={
                        "serviceKey": api_key,
                        "callTp": "L",
                        "pageNo": 1,
                        "numOfRows": 10,
                        "srchKeyCode": "003",
                        "searchWrd": kw,
                    },
                    timeout=25.0,
                )
                if resp.status_code == 200:
                    root = ET.fromstring(resp.text)
                    return root.findall(".//servList")
            except Exception:
                if attempt == 0:
                    await asyncio.sleep(0.8)
        return []

    batches = await asyncio.gather(*(_fetch_kw(kw) for kw in keywords))
    for batch in batches:
        for item in batch:
            serv_id = (item.findtext("servId") or "").strip()
            title = (item.findtext("servNm") or "").strip()
            if not serv_id or not title or serv_id in seen_ids:
                continue
            seen_ids.add(serv_id)

            summary = (item.findtext("servDgst") or "중앙부처 전국 복지지원 사업").strip()
            ministry = (item.findtext("jurMnofNm") or "중앙부처").strip()
            dept = (item.findtext("jurOrgNm") or "").strip()
            provider = f"{ministry} {dept}".strip()
            link = (item.findtext("servDtlLink") or "").strip() or None
            phone = (item.findtext("rprsCtadr") or "").strip() or "129"
            life_array = (item.findtext("lifeArray") or "").strip()
            trg_array = (item.findtext("trgterIndvdlArray") or "").strip()
            thema_array = (item.findtext("intrsThemaArray") or "").strip()
            cycle = (item.findtext("sprtCycNm") or "").strip()
            pvsn = (item.findtext("srvPvsnNm") or "지원").strip()
            online_yn = (item.findtext("onapPsbltYn") or "").strip()

            target_groups, min_age, max_age, category = _parse_bokjiro_targets(
                f"{life_array},{trg_array}", thema_array
            )
            cost_desc = f"{cycle} {pvsn}".strip() if cycle else pvsn
            apply_method = (
                "복지로 온라인 신청 또는 관할 주민센터 방문"
                if online_yn == "Y"
                else "관할 동 주민센터 방문 또는 담당 부처 문의"
            )
            tags = ["전국", "복지로", "중앙부처", ministry]
            for tok in f"{life_array},{trg_array},{thema_array}".split(","):
                t = tok.strip()
                if t and t not in tags:
                    tags.append(t)

            doc = {
                "externalId": f"bokjiro-central:{serv_id}",
                "category": category,
                "title": title,
                "summary": summary,
                "provider": provider,
                "region": {
                    "sido": "전국",
                    "sigungu": "전국",
                    "dong": None,
                    "admCd": "0000000000",
                    "isNationwide": True,
                },
                "address": "전국 온라인·주민센터",
                "cost": {"type": "subsidy", "amount": 0, "description": cost_desc},
                "schedule": {
                    "days": ["mon", "tue", "wed", "thu", "fri"],
                    "timeSlots": ["online", "weekday_day"],
                    "hoursText": "상시 / 사업별 모집기간 확인",
                },
                "deadline": None,
                "isAlwaysOpen": True,
                "eligibility": {
                    "minAge": min_age,
                    "maxAge": max_age,
                    "targetGroups": target_groups,
                    "incomeMaxPct": None,
                    "requiresVerification": ["복지로 공식 페이지에서 세부 소득·자산 기준 확인 필요"],
                    "requiredDocs": ["신분증", "소득·재산 증빙서류"],
                },
                "applyInfo": {
                    "method": apply_method,
                    "url": link,
                    "phone": phone,
                },
                "source": {"name": "한국사회보장정보원(중앙부처복지서비스 API)", "syncedAt": now},
                "tags": tags[:8],
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
    return len(ops)


async def sync_kmooc_courses(
    client: httpx.AsyncClient,
    db: AsyncDatabase,
    api_key: str,
) -> int:
    """국가평생교육진흥원 K-MOOC 강좌정보 API(15042355)로 무료 온라인 공개강좌 동기화."""
    now = datetime.now(UTC)
    now_ts = int(now.timestamp())
    ops: list[UpdateOne] = []

    for page in (1, 2):
        try:
            resp = await client.get(
                KMOOC_LIST_URL,
                params={"serviceKey": api_key, "page": page, "size": 15},
                timeout=15.0,
            )
            if resp.status_code != 200:
                continue
            items = resp.json().get("items") or []
        except Exception as exc:
            logger.warning("[sync_public] K-MOOC fetch failed (p%d): %s", page, exc)
            continue

        for item in items:
            cid = str(item.get("id") or "").strip()
            name = str(item.get("name") or "").strip()
            if not cid or not name:
                continue
            org_name = str(item.get("org_name") or "K-MOOC 참여기관").strip()
            professor = str(item.get("professor") or "").strip()
            url = str(item.get("url") or f"https://www.kmooc.kr/view/course/detail/{cid}").strip()
            end_ts = _safe_int(item.get("enrollment_end"))
            is_auditor = str(item.get("is_auditor") or "").upper() == "Y"
            # 이미 마감되었고 청강도 불가능한 강좌는 제외
            if end_ts and end_ts < now_ts and not is_auditor:
                continue

            deadline_dt = (
                datetime.fromtimestamp(end_ts, tz=UTC)
                if end_ts and end_ts > now_ts
                else None
            )
            prof_text = f" · 담당교수 {professor}" if professor else ""
            doc = {
                "externalId": f"kmooc:{cid}",
                "category": "education",
                "title": f"[K-MOOC] {name}",
                "summary": f"{org_name}{prof_text}에서 제공하는 국가평생교육진흥원 무료 온라인 공개강좌입니다.",
                "provider": f"국가평생교육진흥원 · {org_name}",
                "region": {
                    "sido": "전국",
                    "sigungu": "전국",
                    "dong": None,
                    "admCd": "0000000000",
                    "isNationwide": True,
                },
                "address": "온라인 (K-MOOC)",
                "cost": {"type": "free", "amount": 0, "description": "전액 무료 수강 (이수증 발급)"},
                "schedule": {
                    "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
                    "timeSlots": ["online", "weekday_evening", "weekend"],
                    "hoursText": "온라인 상시 수강 (PC·모바일)",
                },
                "deadline": deadline_dt,
                "isAlwaysOpen": deadline_dt is None,
                "eligibility": {
                    "minAge": None,
                    "maxAge": None,
                    "targetGroups": ["general", "youth", "student", "senior", "job_seeker"],
                    "incomeMaxPct": None,
                    "requiresVerification": [],
                    "requiredDocs": [],
                },
                "applyInfo": {
                    "method": "K-MOOC 홈페이지 무료 회원가입 후 수강신청",
                    "url": url,
                    "phone": "1811-3118",
                },
                "source": {"name": "국가평생교육진흥원(K-MOOC API)", "syncedAt": now},
                "tags": ["K-MOOC", "무료강의", "온라인교육", "평생학습", org_name],
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
    return len(ops)


async def sync_culture_facilities(
    client: httpx.AsyncClient,
    db: AsyncDatabase,
    api_key: str,
    sido: str,
    sigungu: str,
    sgg_cd: str,
) -> int:
    """한국문화정보원 전국문화기반시설총람 API(15125097)로 생활문화센터·문예회관·박물관 등 동기화."""
    sgg5 = sgg_cd[:5]
    op_specs: list[tuple[str, str, str]] = [
        ("clifLvclCntrv1", "lvclCntrNm", "생활문화센터"),
        ("clifClcnv1", "clcnNm", "문예회관"),
        ("clifClhsv1", "clhsNm", "지방문화원"),
        ("clifMsmv1", "msmNm", "박물관"),
        ("clifArglv1", "arglNm", "미술관"),
    ]
    now = datetime.now(UTC)
    raw_entries: list[tuple[str, str, dict]] = []

    async def _fetch_op(op: str, name_key: str, label: str) -> None:
        for yr in ("2024", "2023"):
            try:
                resp = await client.get(
                    f"{CULTURE_FCLT_BASE_URL}/{op}",
                    params={
                        "serviceKey": api_key,
                        "pageNo": 1,
                        "numOfRows": 30,
                        "pblshYr": yr,
                        "sggCd": sgg5,
                        "resultType": "json",
                    },
                    timeout=12.0,
                )
                if resp.status_code != 200:
                    continue
                data = (resp.json().get("response") or {}).get("body", {}).get("data") or []
                if data:
                    for item in data:
                        nm = str(item.get(name_key) or item.get("instNm") or "").strip()
                        if nm and "휴관" not in nm:
                            raw_entries.append((op, label, {**item, "_name": nm}))
                    return
            except Exception:
                continue

    await asyncio.gather(*(_fetch_op(op, nk, lb) for op, nk, lb in op_specs))

    ops: list[UpdateOne] = []
    sem = asyncio.Semaphore(6)

    async def _build_culture_op(op: str, label: str, item: dict) -> UpdateOne | None:
        name = item["_name"]
        addr = str(item.get("instAddr") or "").strip()
        homepage = str(item.get("hmpgAddr") or "").strip() or None
        if homepage and not homepage.startswith(("http://", "https://")):
            homepage = f"https://{homepage}"

        async with sem:
            geo = await kakao_geocode(client, addr or f"{sido} {sigungu} {name}")
        if not geo:
            return None
        lng, lat, adm_cd, dong = geo

        doc = {
            "externalId": f"culture-fclt:{op}:{sgg5}:{name}",
            "category": "culture",
            "title": name,
            "summary": f"{sigungu} 공식 문화기반시설({label})입니다. 전시·공연·생활문화 동아리 및 주민 문화 프로그램을 이용할 수 있습니다.",
            "provider": f"{sigungu} · {label}",
            "region": {
                "sido": sido,
                "sigungu": sigungu,
                "dong": _normalize_dong_name(dong) if dong else None,
                "admCd": adm_cd or sgg_cd,
                "isNationwide": False,
            },
            "location": {"type": "Point", "coordinates": [lng, lat]},
            "address": addr or f"{sido} {sigungu}",
            "cost": {"type": "free", "amount": 0, "description": "무료 또는 공공 문화 요금"},
            "schedule": {
                "days": ["tue", "wed", "thu", "fri", "sat", "sun"],
                "timeSlots": ["weekday_day", "weekend"],
                "hoursText": "화~일 운영 (세부 시간 홈페이지 확인)",
            },
            "deadline": None,
            "isAlwaysOpen": True,
            "eligibility": {
                "minAge": None,
                "maxAge": None,
                "targetGroups": ["general", "youth", "family", "senior"],
                "incomeMaxPct": None,
                "requiresVerification": [],
                "requiredDocs": [],
            },
            "applyInfo": {
                "method": "방문 이용 또는 기관 홈페이지 사전 예약",
                "url": homepage,
                "phone": str(item.get("telno") or "").strip() or None,
            },
            "source": {"name": "한국문화정보원(전국문화기반시설총람 API)", "syncedAt": now},
            "tags": list(dict.fromkeys([sigungu, label, "문화", "생활문화", "여가", "공연"])),
        }
        return UpdateOne(
            {"externalId": doc["externalId"]},
            {"$set": doc, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        )

    built = await asyncio.gather(*(_build_culture_op(op, lb, it) for op, lb, it in raw_entries))
    ops = [op for op in built if op is not None]
    if ops:
        await db["programs"].bulk_write(ops, ordered=False)
    return len(ops)


async def sync_arte_programs(
    client: httpx.AsyncClient,
    db: AsyncDatabase,
    api_key: str,
) -> int:
    """한국문화예술교육진흥원 문화예술교육 자원지도 API(15140200) 동기화 (상위 서버 장애 시 안전 폴백)."""
    try:
        resp = await client.get(
            ARTE_PROGRAM_URL,
            params={"serviceKey": api_key, "pageNo": 1, "numOfRows": 20},
            timeout=10.0,
        )
        if resp.status_code != 200:
            logger.info("[sync_public] Arte API unavailable (HTTP %d); skipped gracefully.", resp.status_code)
            return 0
        root = ET.fromstring(resp.text)
    except Exception as exc:
        logger.info("[sync_public] Arte API skipped gracefully: %s", exc)
        return 0

    now = datetime.now(UTC)
    ops: list[UpdateOne] = []
    for item in root.findall(".//item"):
        title = (item.findtext("progNm") or item.findtext("title") or "").strip()
        pid = (item.findtext("progId") or item.findtext("seq") or title).strip()
        if not title:
            continue
        org = (item.findtext("grpNm") or item.findtext("orgNm") or "한국문화예술교육진흥원").strip()
        summary = (item.findtext("progDesc") or f"{org}에서 운영하는 문화예술교육 프로그램입니다.").strip()
        doc = {
            "externalId": f"arte-prog:{pid}",
            "category": "culture",
            "title": title,
            "summary": summary[:280],
            "provider": org,
            "region": {
                "sido": "전국",
                "sigungu": "전국",
                "dong": None,
                "admCd": "0000000000",
                "isNationwide": True,
            },
            "address": (item.findtext("addr") or "운영 기관 확인").strip(),
            "cost": {"type": "free", "amount": 0, "description": "무료 문화예술교육"},
            "schedule": {
                "days": ["mon", "tue", "wed", "thu", "fri", "sat"],
                "timeSlots": ["weekday_day", "weekend"],
                "hoursText": "프로그램별 일정 확인",
            },
            "deadline": None,
            "isAlwaysOpen": True,
            "eligibility": {
                "minAge": None,
                "maxAge": None,
                "targetGroups": ["general", "youth", "family", "senior"],
                "incomeMaxPct": None,
                "requiresVerification": [],
                "requiredDocs": [],
            },
            "applyInfo": {
                "method": "아르떼(아르떼 홈페이지) 또는 운영 단체 문의",
                "url": (item.findtext("url") or "https://www.arte.or.kr").strip(),
                "phone": (item.findtext("telNo") or "").strip() or None,
            },
            "source": {"name": "한국문화예술교육진흥원(문화예술교육 자원지도 API)", "syncedAt": now},
            "tags": ["문화예술교육", "문화", "악기", "예술", org],
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
    return len(ops)


async def sync_all_public_data(
    db: AsyncDatabase,
    target_gus: list[tuple[str, str, str, str, str]] | None = None,
) -> dict[str, int | str]:
    """9종 공공데이터포털 오픈API + 카카오 로컬을 통합 동기화하고 격차 지수를 동적 산출합니다."""
    if not settings.data_go_kr_key:
        logger.info("[sync_public] DATA_GO_KR_KEY가 비어 있어 공공 API 동기화를 건너뜁니다.")
        return {"status": "skipped", "reason": "missing_data_go_kr_key"}

    async with _sync_lock:
        api_key = unquote(settings.data_go_kr_key.strip())
        gus = target_gus or DEFAULT_TARGET_GUS
        now = datetime.now(UTC)

        async with httpx.AsyncClient() as client:
            # 1) 9종 공공데이터포털 오픈API 병렬 수집
            pop_tasks = [
                fetch_mois_gu_populations(client, api_key, sido, sigungu, seed_admm)
                for sido, sigungu, _sgg_cd, seed_admm, _seed_stdg in gus
            ]
            hh_tasks = [
                fetch_mois_gu_households(client, api_key, seed_stdg)
                for _sido, _sigungu, _sgg_cd, _seed_admm, seed_stdg in gus
            ]
            bokjiro_tasks = [
                sync_bokjiro_local(client, db, api_key, sido, sigungu, sgg_cd)
                for sido, sigungu, sgg_cd, _, _ in gus
            ]
            fclt_tasks = [
                sync_welfare_facilities(client, db, api_key, sido, sigungu, sgg_cd)
                for sido, sigungu, sgg_cd, _, _ in gus
            ]
            lib_tasks = [
                sync_public_libraries(client, db, api_key, sido, sigungu, sgg_cd)
                for sido, sigungu, sgg_cd, _, _ in gus
            ]
            culture_tasks = [
                sync_culture_facilities(client, db, api_key, sido, sigungu, sgg_cd)
                for sido, sigungu, sgg_cd, _, _ in gus
            ]

            (
                pop_results,
                hh_results,
                bokjiro_counts,
                fclt_counts,
                lib_counts,
                culture_counts,
                central_count,
                kmooc_count,
                arte_count,
            ) = await asyncio.gather(
                asyncio.gather(*pop_tasks),
                asyncio.gather(*hh_tasks),
                asyncio.gather(*bokjiro_tasks),
                asyncio.gather(*fclt_tasks),
                asyncio.gather(*lib_tasks),
                asyncio.gather(*culture_tasks),
                sync_bokjiro_central(client, db, api_key),
                sync_kmooc_courses(client, db, api_key),
                sync_arte_programs(client, db, api_key),
            )

            # 법정동별 세대당 인구수(hhNmpr) 병합 -> 1인가구 밀도 보정
            hh_by_base_dong: dict[str, float] = {}
            for hh_map in hh_results:
                hh_by_base_dong.update(hh_map)

            all_dongs: list[dict] = []
            latest_ym: str | None = None
            for ym, dongs in pop_results:
                if ym and (latest_ym is None or ym > latest_ym):
                    latest_ym = ym
                for d in dongs:
                    base_dong = re.sub(r"\d+동$", "동", d["dong"])
                    hh_nmpr = hh_by_base_dong.get(d["dong"]) or hh_by_base_dong.get(base_dong)
                    if hh_nmpr and hh_nmpr < 2.2:
                        # 세대당 인구가 2.2명 미만일수록 1인가구 밀도가 높음 -> 취약 추정 보정
                        single_hh_boost = min(0.08, (2.2 - hh_nmpr) * 0.09)
                        d["population"]["vulnerableRatio"] = round(
                            min(0.45, d["population"]["vulnerableRatio"] + single_hh_boost),
                            4,
                        )
                    all_dongs.append(d)

            if not all_dongs:
                logger.warning("[sync_public] MOIS 인구 API 응답이 비어 있어 region_stats 갱신을 건너뜁니다.")
                return {
                    "status": "partial",
                    "bokjiroLocal": sum(bokjiro_counts),
                    "bokjiroCentral": central_count,
                    "welfareFacilities": sum(fclt_counts),
                    "libraries": sum(lib_counts),
                    "cultureFacilities": sum(culture_counts),
                    "kmooc": kmooc_count,
                    "arte": arte_count,
                    "regions": 0,
                }

            # 2) 각 행정동 중심 좌표 지오코딩 (기존 DB 좌표 재사용 + 미등록 동 카카오 지오코딩)
            existing_centers: dict[str, dict] = {}
            async for existing in db["region_stats"].find({}, {"admCd": 1, "center": 1}):
                if existing.get("admCd") and existing.get("center"):
                    existing_centers[existing["admCd"]] = existing["center"]

            geo_sem = asyncio.Semaphore(6)

            async def _attach_center(d: dict) -> dict | None:
                if d["admCd"] in existing_centers:
                    d["center"] = existing_centers[d["admCd"]]
                    return d
                async with geo_sem:
                    geo = await kakao_geocode(client, f"{d['sido']} {d['sigungu']} {d['dong']} 주민센터")
                    if not geo:
                        geo = await kakao_geocode(client, f"{d['sido']} {d['sigungu']} {d['dong']}")
                    if not geo:
                        return None
                    d["center"] = {"type": "Point", "coordinates": [geo[0], geo[1]]}
                    return d

            located_dongs = [d for d in await asyncio.gather(*(_attach_center(d) for d in all_dongs)) if d is not None]

            # 3) 행정동별 생활권 카카오 공공·문화·교육 시설 보강
            kakao_sem = asyncio.Semaphore(4)

            async def _sync_dong_kakao(d: dict) -> int:
                async with kakao_sem:
                    res = await sync_kakao_community_facilities_for_dong(client, db, d)
                    return int(res.get("upserted", 0))

            kakao_counts = await asyncio.gather(*(_sync_dong_kakao(d) for d in located_dongs))

        # 4) MongoDB programs 실제 분포(동 내 + 도보/생활권 1.3km) 집계 -> 동별 supply 산출
        for d in located_dongs:
            adm_cd = d["admCd"]
            lng, lat = d["center"]["coordinates"]
            counts = {"welfare": 0, "education": 0, "culture": 0}
            seen_prog_ids: set[str] = set()

            async for p in db["programs"].find({"region.admCd": adm_cd}, {"_id": 1, "category": 1}):
                pid = str(p["_id"])
                if pid not in seen_prog_ids and p.get("category") in counts:
                    seen_prog_ids.add(pid)
                    counts[p["category"]] += 1

            near_pipe = [
                {
                    "$geoNear": {
                        "near": {"type": "Point", "coordinates": [lng, lat]},
                        "distanceField": "distM",
                        "maxDistance": 1300,
                        "spherical": True,
                    }
                },
                {"$project": {"_id": 1, "category": 1}},
            ]
            cursor = await db["programs"].aggregate(near_pipe)
            async for p in cursor:
                pid = str(p["_id"])
                if pid not in seen_prog_ids and p.get("category") in counts:
                    seen_prog_ids.add(pid)
                    counts[p["category"]] += 1

            d["supply"] = {
                "welfare": counts["welfare"],
                "education": counts["education"],
                "culture": counts["culture"],
                "total": sum(counts.values()),
            }

        # 5) 수요·공급·격차 지수 동적 계산 (하드코딩 0%)
        scored_dongs = compute_region_scores(located_dongs)
        ym_label = f"{latest_ym[:4]}.{latest_ym[4:]}" if latest_ym and len(latest_ym) == 6 else "최신"
        source_notes = [
            f"행정안전부 행정동별 성/연령별 주민등록 인구수 ({ym_label})",
            f"행정안전부 주민등록 인구 및 세대현황 ({ym_label})",
            "한국사회보장정보원 지자체·중앙부처 복지서비스 API",
            "한국사회보장정보원 사회복지시설정보서비스 API",
            "행정안전부 전국도서관표준데이터 API",
            "한국문화정보원 전국문화기반시설총람 API",
            "국가평생교육진흥원 K-MOOC 강좌정보 API",
            "카카오 로컬 장소 API",
        ]
        if arte_count > 0:
            source_notes.append("한국문화예술교육진흥원 문화예술교육 자원지도 API")

        region_ops = [
            UpdateOne(
                {"admCd": d["admCd"]},
                {
                    "$set": {
                        "admCd": d["admCd"],
                        "sido": d["sido"],
                        "sigungu": d["sigungu"],
                        "dong": d["dong"],
                        "center": d["center"],
                        "population": d["population"],
                        "supply": d["supply"],
                        "scores": d["scores"],
                        "dataSource": "public_api",
                        "statsYm": d.get("statsYm") or latest_ym,
                        "sourceNotes": source_notes,
                        "updatedAt": now,
                    }
                },
                upsert=True,
            )
            for d in scored_dongs
        ]
        if region_ops:
            await db["region_stats"].bulk_write(region_ops, ordered=False)
            synced_codes = [d["admCd"] for d in scored_dongs]
            await db["region_stats"].delete_many({"admCd": {"$nin": synced_codes}, "dataSource": {"$ne": "public_api"}})

        summary = {
            "status": "ok",
            "statsYm": latest_ym or "",
            "regions": len(scored_dongs),
            "bokjiroLocal": sum(bokjiro_counts),
            "bokjiroCentral": central_count,
            "welfareFacilities": sum(fclt_counts),
            "libraries": sum(lib_counts),
            "cultureFacilities": sum(culture_counts),
            "kmooc": kmooc_count,
            "arte": arte_count,
            "kakaoFacilities": sum(kakao_counts),
        }
        logger.info("[sync_public] 실데이터 통합 동기화 완료: %s", summary)
        return summary


async def main() -> None:
    db = await db_manager.connect()
    try:
        result = await sync_all_public_data(db)
        print(f"[ingest] 결과: {result}")
    finally:
        await db_manager.close()


if __name__ == "__main__":
    asyncio.run(main())
