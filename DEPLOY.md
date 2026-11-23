# 도란도란 (DORAN) 배포 가이드 (Vercel + Render + MongoDB Atlas)

무료 티어 기준으로 **10분 내에** 전체 서비스(프론트엔드 · 백엔드 · DB)를 배포하는 절차입니다.

---

## 1단계: MongoDB Atlas (데이터베이스)

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 로그인 후 **M0 (Free)** 클러스터 생성 (리전: **AWS Seoul `ap-northeast-2`** 권장).
2. **Database Access**에서 DB 계정 생성 (예: `doran_app` / 강력한 비밀번호).
3. **Network Access** → **Add IP Address** → **Allow Access from Anywhere (`0.0.0.0/0`)** 허용 (Render 무료 티어는 유동 IP를 사용합니다).
4. **Connect → Drivers (Python)**에서 연결 문자열 복사:
   ```text
   mongodb+srv://doran_app:<비밀번호>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   > 비밀번호에 특수문자(`@`, `:`, `/`, `#`)가 있다면 URL 인코딩하거나 영문+숫자 조합을 사용하세요.

---

## 2단계: Render (FastAPI 백엔드 — `apps/api`)

저장소 루트에 [`render.yaml`](./render.yaml)이 준비되어 있습니다.

1. 먼저 이 저장소를 GitHub(`Neuk9/DORAN`)에 `git push`합니다.
2. [Render 대시보드](https://dashboard.render.com) → **New +** → **Blueprint** → `Neuk9/DORAN` 저장소 선택.
3. 환경변수 입력 화면에서 아래 값을 설정하고 **Apply**:

| 환경변수 | 필수 | 값 예시 |
|---|---|---|
| `MONGODB_URI` | **필수** | 1단계에서 복사한 `mongodb+srv://...` |
| `MONGODB_DB` | 기본값 `doran` | `doran` |
| `AUTO_SEED_IF_EMPTY` | 기본값 `true` | 빈 Atlas DB 첫 기동 시 데모 공공자원 22건 + 행정동 8곳 자동 적재 |
| `CORS_ORIGIN_REGEX` | 기본값 설정됨 | `https://.*\.vercel\.app` (Vercel 배포 및 프리뷰 URL 자동 허용) |
| `LLM_PROVIDER` | 기본값 `mock` | 실제 LLM 사용 시 `openai` 또는 `gemini` |
| `LLM_API_KEY` | 선택 | OpenAI 또는 Gemini API 키 (`mock`일 때는 비워도 됨) |
| `LLM_MODEL` | 기본값 `gpt-4o-mini` | Gemini 사용 시 예: `gemini-2.5-flash` |

4. 배포가 완료되면 발급된 Render URL(예: `https://doran-api.onrender.com`)에서 아래 주소가 정상 응답하는지 확인합니다:
   ```text
   https://<YOUR-RENDER-URL>/api/health
   ```
   → `{"data":{"status":"ok","database":"connected",...}}` 확인!

> 참고: Render Free 플랜은 15분간 요청이 없으면 절전 모드에 들어가 첫 요청 시 약 20~40초 깨어날 수 있습니다.

---

## 3단계: Vercel (Next.js 프론트엔드 — `apps/web`)

1. [Vercel 대시보드](https://vercel.com/new) → **Import Git Repository** → `Neuk9/DORAN` 선택.
2. **Root Directory**를 반드시 **`apps/web`**으로 변경합니다. (Edit 클릭 → `apps/web` 선택)
3. **Environment Variables**에 2단계에서 발급받은 Render 백엔드 주소를 추가합니다:

| 환경변수 | 값 (끝에 `/` 제외) |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://doran-api.onrender.com` |
| `API_BASE_URL` | `https://doran-api.onrender.com` |

4. **Deploy** 클릭!
5. 배포된 Vercel 도메인(예: `https://doran.vercel.app`)을 열면 바로 동작합니다.
   - 커스텀 도메인을 연결한 경우, Render의 `CORS_ORIGINS`에 해당 도메인(`https://your-domain.com`)을 추가해 주세요.

---

## 4단계: 실제 공공데이터 API 동기화 (선택)

Render 서비스의 **Environment**에 공공데이터포털 키(`DATA_GO_KR_KEY`)와 카카오 키(`KAKAO_API_KEY`)를 등록한 뒤, Render Shell 또는 로컬(`.env`에 Atlas `MONGODB_URI` 지정)에서 아래 명령을 실행하면 실데이터가 업서트됩니다.

```bash
make ingest
```
