# 도란도란

> AI 기반 지역사회 사각지대 발굴 및 공공자원 최적 활용 플랫폼

주민이 자연어로 상황을 말하면 AI가 복지·교육·문화 공공자원을 **자격·거리·시간·비용** 기준으로 매칭하고,
동시에 **읍면동 단위 수요-공급 격차**를 드러내는 웹 서비스입니다.

- 공모전: 2026 사회보장 데이터를 활용한 AI 혁신 아이디어 경진대회 (서비스 혁신 분야)
- 핵심 원칙: **LLM은 이해와 설명**, **자격 판정과 랭킹은 결정론**
- 개인정보: 상담 원문 미저장, LLM 전송 전 마스킹, 익명 세션 24시간

## 주요 기능

| 화면 | 내용 |
|---|---|
| `/` 동네 홈 | 지역 선택, 오늘의 추천, 큰글씨 모드 |
| `/chat` AI 상담 | 자연어 → 조건 구조화 → 추천 카드 → 신청 안내 |
| `/explore` 자원 탐색 | 분야·비용·요일·마감 필터, 리스트/지도 |
| `/programs/[id]` 상세 | 자격요건, 신청기간·서류·전화, 출처·기준일 |
| `/report/[admCd]` 격차 리포트 | 수요·공급·격차 지수, 분야별 부족 |
| `/saved` 체크리스트 | 익명 세션 저장, 마감순 정렬 |

위기 신호(자해·학대·단전·단수 등)는 LLM 호출 없이 112·119·129·1366을 즉시 안내합니다.

## 아키텍처

```
Next.js 15 (App Router)  ──REST/SSE──▶  FastAPI
                                         ├─ Intent (LLM, JSON Schema)
                                         ├─ Eligibility (결정론 룰)
                                         ├─ Rank (BM25/벡터 → 가중합 → MMR)
                                         ├─ Explain (근거 기반)
                                         └─ Gap (D/S/G 지표)
                    ▼
PostgreSQL 16 + PostGIS  ·  일 1회 스냅샷(parquet)  ·  ETL
                    ▲
사회보장정보원 · 문화정보원 · 공유누리 · K-MOOC · 행안부 · KOSIS · SGIS
```

## 빠른 시작

### 요구사항

- Python 3.12, [uv](https://docs.astral.sh/uv/)
- Node 20+ (권장 22), pnpm
- Docker / Docker Compose

### 실행

```bash
# 1) 환경변수
cp .env.example .env

# 2) DB
docker compose up -d db

# 3) 의존성
cd apps/api && uv sync && cd ../..
cd packages/etl && uv sync && cd ../..
cd apps/web && pnpm install && cd ../..

# 4) 스키마 + 데모 시드
bash scripts/seed_demo.sh

# 5) API
cd apps/api && uv run uvicorn app.main:app --port 8000

# 6) 웹 (다른 터미널)
cd apps/web && pnpm dev
```

- 웹: http://localhost:3000
- API 문서: http://localhost:8000/docs
- 헬스체크: http://localhost:8000/api/health

LLM을 실제로 사용하려면 `.env`에 `LLM_PROVIDER=openai`, `LLM_API_KEY=...`를 설정합니다.
키가 없으면 `mock` 프로바이더로 동작합니다.

## 테스트

```bash
make test-api   # pytest (Postgres 필요)
make test-etl   # pytest (일부 integration)
make test-web   # Playwright E2E (API·웹 자동 기동)
make lint       # ruff + eslint + tsc + prettier check
```

E2E는 Playwright `webServer`가 시드 → API → 웹을 자동으로 띄웁니다.

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://bigdata:bigdata@localhost:5433/bigdata` | Postgres 연결 |
| `LLM_PROVIDER` | `mock` | `mock` \| `openai` |
| `LLM_API_KEY` | — | LLM API 키 (서버 전용) |
| `LLM_MODEL` | `gpt-4o-mini` | 사용 모델 |
| `KAKAO_API_KEY` | — | 주소→좌표 |
| `DATA_GO_KR_KEY` | — | 공공데이터포털 키 |
| `API_BASE_URL` | `http://localhost:8000` | Next 서버 → API |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | 브라우저 → API |

> API 키는 **서버에서만** 사용합니다. 브라우저 코드에 넣지 마세요.

## 데이터 출처

- 공공데이터포털(data.go.kr): 사회보장정보원 지자체·중앙부처 복지서비스, 사회복지시설, 자원정보, 문화기반시설총람, 문화예술교육 자원지도, 공유누리 교육강좌, K-MOOC
- 복지로(bokjiro.go.kr), KOSIS, SGIS, 행정안전부 주민등록 통계
- 도서관정보나루(data4library.kr)
- 카카오 로컬 API (주소→좌표)

## 프로젝트 구조

```
apps/api/          FastAPI, SQLAlchemy, Alembic, pytest
apps/web/          Next.js, TypeScript, Playwright
packages/etl/      수집기, 정규화, 지표, 적재
eval/              골든셋 50문항, 평가 하네스
scripts/           시드·오프라인 점검
db/init/           PostGIS 확장
```

## 협업

- 브랜치: `main` 보호, 모든 변경은 PR
- 커밋: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- PR 전 `make lint && make test-api && make test-etl` 통과
- 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)

## 라이선스

별도 라이선스가 정해지기 전까지 모든 권리는 저작자에게 있습니다.
