# 기여 가이드

## 1. 개발 환경

```bash
cp .env.example .env
docker compose up -d db
cd apps/api && uv sync && cd ../..
cd packages/etl && uv sync && cd ../..
cd apps/web && pnpm install && cd ../..
bash scripts/seed_demo.sh
```

- Python 3.12 / uv
- Node 20+ / pnpm
- Docker (Postgres+PostGIS)

## 2. 브랜치

| 브랜치 | 용도 |
|---|---|
| `main` | 배포 가능한 상태. 직접 push 금지 |
| `feat/<short-name>` | 기능 |
| `fix/<short-name>` | 버그 |
| `chore/<short-name>` | 설정·문서·CI |

```bash
git switch -c feat/eligibility-parser
```

## 3. 커밋 메시지

Conventional Commits를 사용합니다.

```
feat: 자격요건 파서 신뢰도 임계값 추가
fix: 마감 당일 프로그램이 숨겨지는 문제 수정
docs: 협업 가이드 추가
chore: CI에 ruff 추가
```

- 한 커밋에 한 가지 변경
- 본문에 배경·영향을 적고, 관련 이슈는 `Closes #12`로 연결

## 4. PR

1. PR 템플릿을 채웁니다.
2. `make lint`와 관련 테스트를 통과합니다.
3. 최소 1명의 리뷰 승인 후 squash merge합니다.
4. `main`은 선형 히스토리를 유지합니다.

리뷰어는 아래를 확인합니다.

- [ ] 테스트가 실제 동작을 검증하는가 (통과만 확인하는 테스트 금지)
- [ ] 개인정보가 저장·로그·LLM 전송되지 않는가
- [ ] 추천 결과에 출처·기준일이 있는가
- [ ] 마감일 경계(KST 23:59:59)와 좌표 없음 케이스가 유지되는가

## 5. 코드 규칙

### Python

- `ruff check` + `ruff format`
- 타입 힌트 사용, `from __future__` 불필요 (3.12)
- FastAPI 응답은 `{"data": ..., "meta": {...}}` envelope 유지
- LLM 호출은 `LLMProvider` 인터페이스를 통해서만

### TypeScript

- `tsc --noEmit` 통과
- ESLint + Prettier
- 서버 컴포넌트에서 API 키 접근 금지
- 접근성: 인터랙티브 요소에 접근 가능한 이름, 포커스 링 유지

## 6. 데이터·보안 원칙

- 상담 원문을 DB·로그에 저장하지 않는다.
- LLM 전송 전 `mask_pii()`를 반드시 통과시킨다.
- API 키는 서버 환경변수로만 둔다.
- 위기 키워드는 LLM 호출보다 먼저 처리한다.
- 자격은 "가능성"으로만 안내하고 확정 판정하지 않는다.

## 7. 테스트

```bash
make test-api
make test-etl
make test-web
make lint
```

버그 수정은 **실패하는 테스트를 먼저** 작성합니다.

## 8. 릴리스

- `main` merge 시 CI 통과 필수
- 데모 시드는 `bash scripts/seed_demo.sh`
- 배포는 `docker compose -f docker-compose.prod.yml up -d`
