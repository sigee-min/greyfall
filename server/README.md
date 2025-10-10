Greyfall LLM Logs Server — 사용법

개요
- 역할: LLM 요청/응답을 날짜/타입별(NDJSON)로 저장하고, 세션 인증 기반 대시보드 및 CRUD API를 제공합니다.
- 저장 규칙: 데이터 루트(DATA_ROOT)/YYYY-MM-DD/{request_type}.json 에 JSON Lines(NDJSON)로 append 저장합니다.
- 인증: Google 로그인 교환(`/api/auth/google/signin`) → 서버 JWT 발급(쿠키 `GREYFALLID`), 세션 TTL 기본 5시간.

빠른 시작(로컬)
1) 환경 변수(.env 예시)
   - SERVER_PORT=8080
   - DATA_ROOT=./data/llm-logs
   - MAX_FILE_SIZE_MB=100
   - SESSION_TTL_SEC=18000 # 5시간
   - SESSION_REFRESH_SKEW_SEC=900 # 만료 임박 시 재발급 임계값(초)
   - (고정) COOKIE_NAME은 사용하지 않습니다. 쿠키 이름은 `GREYFALLID`로 고정됩니다.
   - JWT_SECRET=change-me
   - JWT_SECRET=change-me
   - GOOGLE_CLIENT_ID=<your-google-oauth-client-id>

2) 빌드/실행
   - 빌드: `npm run server:build` → 산출물 `server/dist`
   - 실행: `npm run server:start` → 기본 `http://localhost:8080`

3) 대시보드 접속
   - 서버 직접: `http://localhost:8080/dashboard`
   - 프록시 경유(개발): `https://localhost:5173/dashboard` (Vite 프록시가 `/dashboard` → 서버 `/dashboard`로 전달)
   - 프록시 경유(운영/Nginx): `https://<도메인>/dashboard`

API 요약
- 인증: 세션(Bearer 또는 쿠키). 수집 엔드포인트는 예외
- 인증 교환: `POST /api/auth/google/signin` Body `{ credential }` → `{ ok, user, token }` + `Set-Cookie: GREYFALLID=...`
- 세션 확인: `GET /api/auth/me` → `{ ok, user }`
- 로그아웃: `POST /api/auth/logout`
- 사용자 프로필: `GET /api/users/me` → `{ ok, user: { id, name, picture, role } }`
- Health: `GET /api/health` → `{ ok: true, ts }`
- 일자 목록: `GET /api/dates` → `{ dates: ["YYYY-MM-DD", ...] }`
- 타입 목록: `GET /api/types?date=YYYY-MM-DD` → `{ date, types: ["npc.reply", ...] }`
- 로그 적재(Create/Append): `POST /api/llm/logs` (인증 불필요)
  - Body(단건 또는 배열):
    {
      "request_id": "문자열 식별자",
      "request_type": "예: npc.reply | scene.brief | ...",
      "input_text": "페르소나 포함 요청 원문",
      "output_text": "LLM 최종 결과",
      "client_at": "선택: ISO8601"
    }
  - 응답: `{ date, results: [{ request_id, file, rev }] }`
- 수정(Update): `PATCH /api/llm/logs/{request_id}?date=YYYY-MM-DD&request_type=...`
  - Body: 변경 필드(예: output_text)
  - Append 기반으로 rev 증가(op=update)
- 삭제(Delete, tombstone): `DELETE /api/llm/logs/{request_id}?date=YYYY-MM-DD&request_type=...`
  - Append 기반으로 tombstone(op=delete)
- 목록(Read): `GET /api/llm/logs?date=YYYY-MM-DD&request_type=...&q=...&page=1&page_size=50`
  - `q`가 있으면 input_text / output_text 포함 검색
- 단건(Read): `GET /api/llm/logs/{request_id}?date=YYYY-MM-DD&request_type=...`
  - `{ latest, history }` 반환(리비전 정렬)
- 다운로드: `GET /api/download?date=YYYY-MM-DD&request_type=...&format=ndjson|json`

데이터 저장 구조
- 파티션: `YYYY-MM-DD/`
- 파일: `{request_type}.json`(NDJSON). 용량 초과 시 `{request_type}-0001.json` 등으로 로테이션
- 인덱스: `YYYY-MM-DD/_index/{request_type}.index.json`
  - `request_id → { file, rev, tombstone, lastUpdated }`

대시보드(서버 엔드포인트)
- 홈: `GET /dashboard`
- 일자: `GET /dashboard/dates`
- 타입: `GET /dashboard/date/{YYYY-MM-DD}`
- 목록: `GET /dashboard/logs?date=YYYY-MM-DD&request_type=...&q=...&page=...`
- 상세: `GET /dashboard/logs/{request_id}?date=YYYY-MM-DD&request_type=...`

프런트엔드 연동(단일 훅)
- LLM 완료 시 프런트에서 `/api/llm/logs`로 Fire-and-Forget 전송합니다(실패 시 무시). 인증은 필요 없습니다.
- 기본 경로는 same-origin `/api`입니다. 운영 환경에서는 프록시 레벨에서 레이트리밋/IP 제한 적용을 권장합니다.

리버스 프록시 권장(Nginx)
- TLS 오프로드 및 인증/접근 제어는 프록시에서 담당
- 예시 매핑
  - `/api/*` → 로그 서버 (예외: `/api/sessions`, `/api/health` → 시그널 서버)
- `/dashboard` → 로그 서버 `/dashboard`

보안/운영 메모
- 프록시에서 TLS 종단 및 접근 제어 수행, API는 Bearer 권장(변경 요청 시).
- 대용량 데이터에 대비해 로테이션/컴팩션(야간)과 백업/보존정책을 운영 환경에서 스케줄링하세요.
- 권한: `role ∈ { user, admin, sysadmin }` (sysadmin > admin > user). `SYSADMIN_EMAILS`, `ADMIN_EMAILS`, `ALLOWED_EMAIL_DOMAINS`로 자동 부여.

개발 팁(테스트)
- 헬스: `curl -u admin:admin http://localhost:8080/api/health`
- 적재: `curl -u admin:admin -H 'Content-Type: application/json' \
  -d '{"request_id":"r1","request_type":"npc.reply","input_text":"...","output_text":"..."}' \
  http://localhost:8080/api/llm/logs`
- 대시보드: `http://localhost:8080/dashboard`

소스 구조
- `server/src/index.ts`  HTTP 서버 및 라우팅
- `server/src/storage.ts` NDJSON append/로테이션/인덱스
- `server/src/routes/auth.ts` 세션 교환/확인/로그아웃 라우트
- `server/src/middleware/auth.ts` 보호 라우트 가드(JWT/쿠키)
- `server/src/config.ts`  환경 변수 로드
- `server/src/utils.ts`   유틸(파서, 날짜 등)
- `server/src/types.ts`   타입 정의

라이선스/주석
- 현재 서버는 Node 내장 모듈로만 동작합니다. 외부 디펜던시는 빌드 타임(TypeScript) 용도에 한정됩니다.

## Environment Variables

- `SERVER_PORT` (기본 8080) — HTTP 포트
- `DATA_ROOT` (기본 `./data/llm-logs`) — 데이터 루트 디렉터리
- `MAX_FILE_SIZE_MB` (기본 100) — 파일 로테이션 임계값(MB)
- `GOOGLE_CLIENT_ID` (필수) — Google ID 토큰 검증용 클라이언트 ID
- `JWT_SECRET` (필수/운영) — 서버 세션 JWT 서명 시크릿
- `SESSION_TTL_SEC` (기본 18000=5h) — 세션 유효기간
- `SESSION_REFRESH_SKEW_SEC` (기본 900=15m) — 만료 임박 시 갱신 임계값
  
  COOKIE_NAME은 더 이상 사용하지 않습니다. 세션 쿠키 이름은 `GREYFALLID`로 고정됩니다.
- `SYSADMIN_EMAILS` — 세미콜론/쉼표/공백 구분. 일치 이메일은 sysadmin 부여
- `ADMIN_EMAILS` — 세미콜론/쉼표/공백 구분. 일치 이메일은 admin 부여
- `ALLOWED_EMAIL_DOMAINS` — 도메인 화이트리스트(예: `example.com dev.local`)
