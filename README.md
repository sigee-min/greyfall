# Greyfall TRPG 콘솔

Greyfall TRPG 관제 콘솔의 프론트엔드 기본 골격입니다. React와 PixiJS를 결합해 전술 스테이지, 플레이어 관리, 실시간 채팅·시그널링을 하나의 화면에서 제어할 수 있도록 설계했습니다. 프로젝트의 전체적인 목표와 도메인 흐름은 `PLAN.md`에, 세부 씬 구성은 `docs/scenes.md`에 정리되어 있습니다.

## 주요 특징

- **React + Vite**: 빠른 HMR과 타입 안전한 UI 컴포넌트 개발 환경.
- **PixiJS 스테이지**: `src/stage`에 위치한 어댑터를 통해 2D 전술 맵을 렌더링.
- **Zustand 상태 관리**: 세션, 참가자, UI 패널 상태를 전역 스토어로 통합.
- **WebRTC 데이터 채널**: `src/rtc/webrtc.ts`가 호스트·게스트 간 동기화 채널을 제공합니다.
- **커스텀 커서 & UI SFX**: `src/lib` 내 훅으로 몰입감 있는 조작 경험 제공.
- **로컬 LLM 브리지**: `src/llm` 디렉터리에 WebGPU 기반 어댑터 초안이 포함되어 있습니다.

## 설치 및 실행

필수 조건: Node.js 18 이상, npm 9 이상.

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:5173)
npm run dev

# 프로덕션 빌드 산출물 생성
npm run build
```

테스트 스크립트는 아직 정의되지 않았습니다. 필요 시 `npm run lint`로 빠르게 형식 오류를 확인할 수 있습니다.

## 프로젝트 구조

```
src/
├─ app.tsx                # 최상위 레이아웃 및 씬 전환
├─ stages/, ui/, session/  # 스테이지, UI 패널, 세션 로직
├─ lib/                    # 커스텀 훅 및 공용 유틸
├─ rtc/                    # WebRTC 브리지 코드
├─ store/                  # Zustand 스토어 정의
└─ ...
public/
├─ assets/                # 이미지, 오디오, 커서 등 정적 리소스
└─ index.html             # Vite 진입점
```

추가적인 규칙과 팀 개발 흐름은 `DEVELOPER_GUIDE.md`, 배포 헤더는 `./_headers`를 참고하세요.

## 개발 가이드

1. **시그널 서버 연동**: `signal/` 디렉터리가 클라이언트와 별도로 관리됩니다. 로컬 테스트 시 두 프로세스를 동시에 실행하세요.
2. **커스텀 씬 추가**: `docs/scenes.md`에 씬 시나리오를 먼저 기술한 뒤 `src/scenes`에 컴포넌트를 추가하는 것을 권장합니다.
3. **오디오 정책**: 브라우저 자동 재생 제한 때문에 배경 음악은 사용자 상호작용 후 재생이 시작됩니다. 관련 훅은 `src/lib/background-music.ts`에 있습니다.
4. **배포**: 정적 빌드 결과물은 `dist/`에 생성되며 Netlify·Cloudflare Pages와 같은 정적 호스팅 환경을 기준으로 구성돼 있습니다.

## 라이선스

이 저장소는 `LICENSE`에 명시된 *Greyfall Console Non-Commercial License* 하에 배포됩니다. Greyfall 내부 평가 및 비상업적 세션 외의 사용, 재배포, 상업적 활용은 모두 금지되며 추가 권한이 필요한 경우 Greyfall 운영팀의 서면 승인이 필요합니다.
