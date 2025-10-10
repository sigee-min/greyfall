# Greyfall Signal Server

간단한 WebRTC 시그널링 서버로, Render와 같은 Node 호스팅에 배포해 Greyfall 콘솔의 자동 연결을 지원합니다.

## 빠른 시작

```bash
cd signal
npm install
npm run dev
```

기본 포트는 `8787`이며 `http://localhost:8787/health` 엔드포인트로 상태를 확인할 수 있습니다. `SIGNAL_PORT`(또는 기존 `PORT`) 환경 변수로 포트를 변경할 수 있습니다. Vite 프런트엔드에서는 `VITE_SIGNAL_SERVER_URL` 환경 변수를 통해 서버 주소를 지정합니다.

옵션 인증: `SIGNAL_AUTH_REQUIRED=1`로 설정하면
- HTTP: `POST /sessions` 호출 시 `Authorization: Bearer <JWT>`(또는 `?token=`) 필요
- WebSocket: `/ws?session=...&role=...&token=<JWT>` 필요
토큰은 서버와 동일한 `JWT_SECRET`으로 서명된 JWT여야 합니다.

## Render 배포 가이드

1. Render 대시보드에서 **New Web Service**를 선택하고 Git 리포지토리를 연결합니다.
2. 루트 대신 `signal/` 디렉터리를 서비스 경로로 지정합니다.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm run start`
5. 무료 인스턴스 기준으로 포트는 Render가 제공하는 `$PORT` 환경 변수를 사용하므로 추가 설정은 필요하지 않습니다.

배포 후 생성된 주소를 프런트엔드 `.env` 파일의 `VITE_SIGNAL_SERVER_URL`로 설정하면, 호스트와 게스트가 코드를 주고받지 않아도 자동으로 연결됩니다.

## Environment Variables

- `SIGNAL_PORT` 또는 `PORT` (기본 8787) — HTTP/WS 포트
- `SIGNAL_AUTH_REQUIRED` (기본 0) — `1`이면 인증 필수
- `JWT_SECRET` — `SIGNAL_AUTH_REQUIRED=1`일 때 JWT 검증에 사용(서버와 동일하게 설정)
- 클라이언트 참조: `VITE_SIGNAL_SERVER_URL` — 프런트엔드에서 시그널 서버 절대 URL 지정
