Greyfall LLM Logs Server — 사용법

개요
- 역할: LLM 요청/응답을 날짜/타입별(NDJSON)로 저장하고, Basic Auth 대시보드 및 CRUD API를 제공합니다.
- 저장 규칙: 데이터 루트(DATA_ROOT)/YYYY-MM-DD/{request_type}.json 에 JSON Lines(NDJSON)로 append 저장합니다.
- 인증: HTTP Basic Auth. 대시보드/모든 API 공통으로 적용합니다.

빠른 시작(로컬)
1) 환경 변수(.env 예시)
   - PORT=8080
   - DATA_ROOT=./data/llm-logs
   - MAX_FILE_SIZE_MB=100
   - AUTH_BASIC_ENABLED=true
   - AUTH_USERS=admin:admin;viewer:viewer

2) 빌드/실행
   - 빌드: `npm run server:build` → 산출물 `server/dist`
   - 실행: `npm run server:start` → 기본 `http://localhost:8080`

3) 대시보드 접속
   - 서버 직접: `http://localhost:8080/dashboard`
   - 프록시 경유(개발): `https://localhost:5173/server/dashboard` (Vite 프록시가 `/server/dashboard` → 서버 `/dashboard`로 전달)
   - 프록시 경유(운영/Nginx): `https://<도메인>/server/dashboard`

API 요약
- 인증: Basic Auth 필요(`Authorization: Basic base64(user:pass)`)
- Health: `GET /api/health` → `{ ok: true, ts }`
- 일자 목록: `GET /api/dates` → `{ dates: ["YYYY-MM-DD", ...] }`
- 타입 목록: `GET /api/types?date=YYYY-MM-DD` → `{ date, types: ["npc.reply", ...] }`
- 로그 적재(Create/Append): `POST /api/llm/logs`
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
- LLM 완료 시 프런트에서 `/api/llm/logs`로 Fire-and-Forget 전송합니다(실패 시 무시).
- 기본 경로는 same-origin `/api`이며, Basic Auth는 환경변수(VITE_LOGS_BASIC_USER/PASS)로 주입합니다.

리버스 프록시 권장(Nginx)
- TLS 오프로드 및 인증/접근 제어는 프록시에서 담당
- 예시 매핑
  - `/api/*` → 로그 서버 (예외: `/api/sessions`, `/api/health` → 시그널 서버)
  - `/server/dashboard` → 로그 서버 `/dashboard`

보안/운영 메모
- HTTP를 사용하되(프록시에서 TLS 종단), Basic Auth 자격은 네트워크 레벨 제약(IP, 레이트리밋)과 함께 운용을 권장합니다.
- 대용량 데이터에 대비해 로테이션/컴팩션(야간)과 백업/보존정책을 운영 환경에서 스케줄링하세요.

개발 팁(테스트)
- 헬스: `curl -u admin:admin http://localhost:8080/api/health`
- 적재: `curl -u admin:admin -H 'Content-Type: application/json' \
  -d '{"request_id":"r1","request_type":"npc.reply","input_text":"...","output_text":"..."}' \
  http://localhost:8080/api/llm/logs`
- 대시보드: `http://localhost:8080/dashboard`

소스 구조
- `server/src/index.ts`  HTTP 서버 및 라우팅
- `server/src/storage.ts` NDJSON append/로테이션/인덱스
- `server/src/auth.ts`    Basic Auth 검사
- `server/src/config.ts`  환경 변수 로드
- `server/src/utils.ts`   유틸(파서, 날짜 등)
- `server/src/types.ts`   타입 정의

라이선스/주석
- 현재 서버는 Node 내장 모듈로만 동작합니다. 외부 디펜던시는 빌드 타임(TypeScript) 용도에 한정됩니다.
