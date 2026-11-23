# 도란도란 (DORAN)

[![CI](https://github.com/Neuk9/DORAN/actions/workflows/ci.yml/badge.svg)](https://github.com/Neuk9/DORAN/actions/workflows/ci.yml)
[![E2E](https://github.com/Neuk9/DORAN/actions/workflows/e2e.yml/badge.svg)](https://github.com/Neuk9/DORAN/actions/workflows/e2e.yml)

> AI 기반 개인 맞춤형 공공자원 추천 및 지역별 수요·공급 격차 분석 플랫폼  
> 운영 서비스: https://doran.stda.app

주민이 일상 말이나 음성으로 자신의 상황을 말하면 AI가 복지·교육·문화 공공자원을 **자격·거리·비용·운영시간** 기준으로 매칭해 바로 신청·길찾기까지 연결하고, 동시에 **읍면동 단위 수요·공급 격차와 미보유 필요 공공시설**을 실시간 공공데이터로 분석하는 웹 서비스입니다.

- 핵심 원칙: **LLM은 자연어 이해와 브리핑**, **자격 판정·랭킹·격차 산출은 결정론**
- 개인정보: 상담 원문 미저장, LLM 전송 전 PII 마스킹, 익명 체크리스트 24시간 TTL 자동 만료
- 안전 대응: 위기 신호(자해·학대·단전·단수 등)는 LLM 호출 없이 112·119·129·1366을 즉시 안내

## 주요 기능

| 화면 | 내용 |
|---|---|
| `/` AI 검색 홈 | 일상어·음성 검색, 우리 동네 실시간 현황 벤토 카드, 맞춤 혜택 요약 + 바로 신청·카카오맵 길찾기, 인터랙티브 지도(카카오맵/Leaflet), 제외 사유 투명 리포트 |
| `/explore` 전체 탐색 | 분야·비용·운영시간·마감 필터, 리스트/지도 전환, 최대 3개 나란히 비교 |
| `/programs/[id]` 상세 | 2컬럼 스티키 신청·전화·길찾기 패널, 자격요건, 준비 서류 체크리스트, 출처·기준일 |
| `/report/[admCd]` 지역 격차 | 행정동별 실시간 수요·공급·격차 지수, 인구 분포 × 미보유 필요 공공시설 추천, 정책·ESG 시뮬레이터, 공공 API 수동 최신화 |
| `/saved` 체크리스트 | 익명 세션 저장(24시간 TTL), 마감순 정렬 |

## 연동 공공데이터 및 외부 API

공공데이터포털(`DATA_GO_KR_KEY` 1개로 통합)과 카카오 로컬·지도를 실연동해 백그라운드 자동 동기화(12시간 주기) 및 수동 최신화(`POST /api/regions/sync`)를 지원합니다.

| 구분 | 출처 / 오픈API | 역할 |
|---|---|---|
| **수요 (인구)** | 행정안전부 `행정동별 성/연령별 주민등록 인구수` (`15108072`) | 행정동별 총인구·청년·고령층 실인구 집계 |
| **수요 (세대)** | 행정안전부 `법정동별 주민등록 인구 및 세대현황` (`15108071`) | 세대당 인구수 기반 1인가구 밀도 보정 |
| **공급 (지자체 복지)** | 한국사회보장정보원 `지자체복지서비스` | 구로구·금천구 실제 지자체 복지 프로그램 |
| **공급 (중앙부처 복지)** | 한국사회보장정보원 `중앙부처복지서비스` (`15090532`) | 청년내일저축계좌·기초연금·아이돌봄·에너지바우처 등 전국 복지사업 |
| **공급 (복지 시설)** | 한국사회보장정보원 `사회복지시설정보서비스 현황` | 노인·아동·장애인·가족 실제 복지시설 좌표 매칭 |
| **공급 (도서관)** | 행정안전부 `전국도서관표준데이터` | 공공도서관 운영시간·장서·열람석·좌표 |
| **공급 (온라인 교육)** | 국가평생교육진흥원 `K-MOOC 강좌정보` (`15042355`) | 전국 무료 온라인 공개강좌 |
| **공급 (문화 시설)** | 한국문화정보원 `전국문화기반시설총람` (`15125097`) | 생활문화센터·문예회관·지방문화원·박물관·미술관 |
| **공급 (문화예술교육)** | 한국문화예술교육진흥원 `문화예술교육 자원지도` (`15140200`) | 문화예술교육 프로그램 연동 (장애 시 안전 폴백) |
| **위치 · 지도** | 카카오 로컬 REST API · 카카오맵 JS SDK | 주소↔좌표 지오코딩, 행정동 역지오코딩, 생활권 공공시설 조회 및 지도 시각화 |

## 아키텍처

```text
Next.js 15 (App Router, TS, Tailwind)  ──REST──▶  FastAPI (Python 3.12, uv)
  ├─ Kakao Maps JS SDK (Leaflet 폴백)               ├─ Safety (위기감지 + PII 마스킹)
  ├─ Recharts (격차·공급 시각화)                    ├─ Intent/Briefing (mock / openai / openai-compatible / gemini)
  └─ Web Speech API (실시간 한국어 음성 입력)        ├─ Eligibility & Ranking (결정론 규칙 + 2dsphere 거리)
                                                    ├─ Planner (예상 혜택 합산 · 실행 플랜 · 제외 투명성)
                                                    ├─ Gap (동적 수요·공급 격차 산출 · 미보유 필요시설 추천)
                                                    └─ Ingest (시드 · 9종 공공 OpenAPI 통합 동기화)
                                                         ▼
                                             MongoDB 7+ (로컬 Docker / MongoDB Atlas 공용)
                                             programs (2dsphere) · region_stats · saved_sessions (TTL)
```

## 빠른 시작

### 요구사항

- Python 3.12, [uv](https://docs.astral.sh/uv/)
- Node 20+ (권장 22), pnpm
- Docker / Docker Compose (또는 MongoDB Atlas URI)

### 실행

```bash
# 1) 환경변수 복사
cp .env.example .env

# 2) 로컬 MongoDB 실행 + 의존성 설치
make setup

# 3) 데모 시드 또는 공공 API 실데이터 동기화
make seed
make sync-public   # DATA_GO_KR_KEY 설정 시 9종 공공 API 실데이터 적재

# 4) 백엔드 API 실행 (http://localhost:8000)
make dev-api

# 5) 프론트엔드 웹 실행 (다른 터미널, http://localhost:3000)
make dev-web
```

- 웹: http://localhost:3000
- API 문서(Swagger): http://localhost:8000/docs
- 헬스체크: http://localhost:8000/api/health

### LLM 실제 모델 연동

기본값 `LLM_PROVIDER=mock`에서는 API 키 없이도 규칙 기반 파서/설명기로 전체 기능을 테스트할 수 있습니다.
실제 LLM을 사용하려면 `.env`에 아래를 설정하세요.

```env
LLM_PROVIDER=openai-compatible   # mock | openai | openai-compatible | gemini
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=...
LLM_MODEL=gpt-4o-mini
```

## 테스트 및 품질 검사

```bash
make test-api   # pytest (MongoDB 단위·통합 테스트)
make lint       # ruff + tsc + eslint
make build-web  # Next.js 프로덕션 빌드 검증
```

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017` | 로컬 Docker 또는 MongoDB Atlas URI |
| `MONGODB_DB` | `doran` | 데이터베이스 이름 |
| `LLM_PROVIDER` | `mock` | `mock` \| `openai` \| `openai-compatible` \| `gemini` |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI 호환 게이트웨이 엔드포인트 |
| `LLM_API_KEY` | — | LLM API 키 (서버 전용) |
| `LLM_MODEL` | `gpt-4o-mini` | LLM 모델명 |
| `KAKAO_API_KEY` | — | 카카오 로컬 REST API 키 (서버 전용, 지오코딩·시설 조회) |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | — | 카카오맵 JavaScript 키 (미설정 시 Leaflet 자동 폴백) |
| `DATA_GO_KR_KEY` | — | 공공데이터포털 일반 인증키 (서버 전용, 9종 오픈API 실데이터 동기화) |
| `CORS_ORIGINS` | `http://localhost:3000` | 허용 프론트엔드 Origin 목록 (쉼표 구분) |
| `API_BASE_URL` | `http://localhost:8000` | Next 서버 → FastAPI |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | 브라우저 → FastAPI |

> 비밀 키(`LLM_API_KEY`, `KAKAO_API_KEY`, `DATA_GO_KR_KEY`)는 **서버 환경변수에서만** 사용합니다. 브라우저 코드에 넣지 마세요.

## 프로젝트 구조

```text
apps/api/          FastAPI, PyMongo Async, 하이브리드 AI 엔진, 9종 공공 API 동기화, 동적 격차 산출
apps/web/          Next.js 15, TypeScript, Tailwind CSS, 카카오맵/Leaflet, Recharts
docs/proposal/     아이디어 제안서 원본 문서
```

## 협업

- 브랜치: `main` 보호, 모든 변경은 PR
- 커밋: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- PR 전 `make lint && make test-api && make build-web` 통과
- 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)

## 라이선스

별도 라이선스가 정해지기 전까지 모든 권리는 저작자에게 있습니다.
