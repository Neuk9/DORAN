# 기여 가이드

## 1. 개발 환경

```bash
cp .env.example .env
make setup
make seed
```

- Python 3.12 / [uv](https://docs.astral.sh/uv/)
- Node 20+ (권장 22) / pnpm
- MongoDB 7+ (로컬 Docker Compose 또는 MongoDB Atlas `MONGODB_URI`)

## 2. 브랜치

| 브랜치 | 용도 |
|---|---|
| `main` | 배포 가능한 상태. 직접 push 금지 |
| `feat/<short-name>` | 기능 |
| `fix/<short-name>` | 버그 |
| `chore/<short-name>` | 설정·문서·CI |

```bash
git switch -c feat/eligibility-engine
```

## 3. 커밋 메시지

Conventional Commits를 사용합니다.

```
feat: 결정론적 자격요건 판정 엔진 구현
fix: 마감 당일(KST 23:59:59) 프로그램이 숨겨지는 문제 수정
docs: MongoDB 아키텍처 가이드 추가
chore: CI MongoDB 서비스 컨테이너 전환
```

- 한 커밋에 한 가지 변경
- 본문에 배경·영향을 적고, 관련 이슈는 `Closes #12`로 연결

## 4. PR

1. PR 템플릿을 채웁니다.
2. `make lint && make test-api && make build-web`를 통과합니다.
3. 최소 1명의 리뷰 승인 후 squash merge합니다.
4. `main`은 선형 히스토리를 유지합니다.

리뷰어는 아래를 확인합니다.

- [ ] 테스트가 실제 동작을 검증하는가 (통과만 확인하는 테스트 금지)
- [ ] 개인정보가 저장·로그·LLM 전송되지 않는가
- [ ] 추천 결과에 출처·기준일이 있는가
- [ ] 마감일 경계(KST 23:59:59)와 좌표 없음 케이스가 유지되는가
- [ ] MongoDB 쿼리가 로컬 Docker와 Atlas 양쪽에서 모두 동작하는가

## 5. 코드 규칙

### Python (`apps/api`)

- `ruff check` + `ruff format`
- 타입 힌트 사용, Pydantic v2 모델 기반 검증
- FastAPI 응답은 `{"data": ..., "meta": {...}}` envelope 유지
- LLM 호출은 `LLMProvider` 인터페이스를 통해서만 수행
- Atlas 전용 API에 종속되지 않도록 표준 MongoDB 인덱스·Aggregation 사용

### TypeScript (`apps/web`)

- `tsc --noEmit` 통과
- ESLint + Prettier
- 브라우저 코드에 API 키 노출 금지
- 접근성: 인터랙티브 요소에 접근 가능한 이름, 포커스 링, 큰글씨 모드 대응 유지

## 6. 데이터·보안 원칙

보안 취약점 제보는 [SECURITY.md](SECURITY.md)를 따릅니다. 공개 이슈에 취약점을 올리지 마세요.

- 상담 원문을 DB·로그에 저장하지 않는다.
- LLM 전송 전 `mask_pii()`를 반드시 통과시킨다.
- API 키는 서버 환경변수로만 둔다.
- 위기 키워드는 LLM 호출보다 먼저 처리한다.
- 자격은 "가능성"으로만 안내하고 확정 판정하지 않는다.

## 7. 테스트

```bash
make test-api
make lint
make build-web
```

버그 수정은 **실패하는 테스트를 먼저** 작성합니다.

## 8. 사전 커밋 훅

```bash
uv tool install pre-commit
make hooks
```

훅은 ruff(API), prettier(웹), tsc(웹)를 실행합니다.

`main`은 보호됩니다: PR 필수, 리뷰 1명, CI(api/web) 통과, 선형 히스토리, force push 금지.
보안 취약점은 [SECURITY.md](SECURITY.md)의 비공개 제보 절차를 따릅니다.

## 9. 릴리스

- `main` merge 시 CI 통과 필수
- 데모 시드는 `make seed`
- 배포는 `docker compose -f docker-compose.prod.yml up -d` (외부 MongoDB Atlas 사용 시 `MONGODB_URI` 설정)
