# 도란도란 (DORAN)

[![CI](https://github.com/Neuk9/DORAN/actions/workflows/ci.yml/badge.svg)](https://github.com/Neuk9/DORAN/actions/workflows/ci.yml)
[![E2E](https://github.com/Neuk9/DORAN/actions/workflows/e2e.yml/badge.svg)](https://github.com/Neuk9/DORAN/actions/workflows/e2e.yml)

> AI 기반 개인 맞춤형 공공자원 추천 및 지역별 수요·공급 격차 분석 플랫폼

주민이 자연어로 자신의 상황을 말하면 AI가 복지·교육·문화 공공자원을 **자격·거리·비용·운영시간** 기준으로 매칭하고,
동시에 **읍면동 단위 수요·공급 격차**를 분석하는 웹 서비스입니다.

- 핵심 원칙: **LLM은 이해와 설명**, **자격 판정과 랭킹은 결정론**
- 개인정보: 상담 원문 미저장, LLM 전송 전 PII 마스킹, 익명 체크리스트 24시간 TTL 자동 만료
- 안전 대응: 위기 신호(자해·학대·단전·단수 등)는 LLM 호출 없이 112·119·129·1366을 즉시 안내

## 주요 기능

| 화면 | 내용 |
|---|---|
| `/` 동네 홈 | 우리 동네 선택, 자연어 바로 검색, 오늘의 추천, 큰글씨 모드 |
| `/chat` AI 상담 | 일상어 입력 → 조건 JSON 구조화 → 자격 판정 배지·추천 근거 카드 |
| `/explore` 자원 탐색 | 분야·비용·요일·마감 필터, 리스트/지도(Leaflet) 전환 |
| `/programs/[id]` 상세 | 자격요건, 필요 서류, 신청 경로·전화, 출처·기준일 |
| `/report/[admCd]` 격차 리포트 | 읍면동 수요·공급·격차 지수, 분야별 부족 현황 차트 |
| `/saved` 체크리스트 | 익명 세션 저장(24시간 TTL), 마감순 정렬 |

## 아키텍처

```text
Next.js 15 (App Router, TS, Tailwind)  ──REST──▶  FastAPI (Python 3.12, uv)
                                                   ├─ Safety (위기감지 + PII 마스킹)
                                                   ├─ Intent (LLMProvider: mock / openai / gemini)
                                                   ├─ Eligibility (결정론 규칙 판정)
                                                   ├─ Ranking (2dsphere 거리 + 다차원 스코어링)
                                                   ├─ Explain (근거 기반 추천 사유)
                                                   ├─ Gap (읍면동 수요·공급 격차 분석)
                                                   └─ Ingest (시드 · 공공 API 수집 CLI)
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

# 3) 데모 데이터 시드 (인덱스 자동 생성 + idempotent 업서트)
make seed

# 4) 백엔드 API 실행 (http://localhost:8000)
make dev-api

# 5) 프론트엔드 웹 실행 (다른 터미널, http://localhost:3000)
make dev-web
```

- 웹: http://localhost:3000
- API 문서(Swagger): http://localhost:8000/docs
- 헬스체크: http://localhost:8000/api/health

### MongoDB Atlas 연결

`.env`의 `MONGODB_URI`를 Atlas 연결 문자열(`mongodb+srv://...`)로 바꾸면 코드 변경 없이 그대로 동작합니다.

### LLM 실제 모델 연동

기본값 `LLM_PROVIDER=mock`에서는 API 키 없이도 규칙 기반 파서/설명기로 전체 기능을 테스트할 수 있습니다.
실제 LLM을 사용하려면 `.env`에 아래를 설정하세요.

```env
LLM_PROVIDER=openai   # 또는 gemini
LLM_API_KEY=...
LLM_MODEL=gpt-4o-mini # gemini 사용 시 예: gemini-2.5-flash
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
| `LLM_PROVIDER` | `mock` | `mock` \| `openai` \| `gemini` |
| `LLM_API_KEY` | — | LLM API 키 (서버 전용) |
| `LLM_MODEL` | `gpt-4o-mini` | LLM 모델명 |
| `KAKAO_API_KEY` | — | 카카오 로컬 API 키 (선택, 주소→좌표 지오코딩) |
| `DATA_GO_KR_KEY` | — | 공공데이터포털 API 키 (선택, 실데이터 동기화) |
| `API_BASE_URL` | `http://localhost:8000` | Next 서버 → FastAPI |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | 브라우저 → FastAPI |

> API 키는 **서버 환경변수에서만** 사용합니다. 브라우저 코드에 넣지 마세요.

## 프로젝트 구조

```text
apps/api/          FastAPI, PyMongo Async, 하이브리드 AI 엔진, 데이터 시드·수집 CLI
apps/web/          Next.js 15, TypeScript, Tailwind CSS, Leaflet 지도, Recharts
docs/proposal/     아이디어 제안서 원본 문서
```

## 협업

- 브랜치: `main` 보호, 모든 변경은 PR
- 커밋: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- PR 전 `make lint && make test-api && make build-web` 통과
- 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)

## 라이선스

별도 라이선스가 정해지기 전까지 모든 권리는 저작자에게 있습니다.
