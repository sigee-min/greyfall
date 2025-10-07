# Transformers.js 지식 노트 (예제 기반 요약)

본 문서는 Hugging Face Transformers.js 예제와 소스(예: `src/pipelines.js`, `src/models.js`, `src/env.js`)를 참고해, 브라우저에서 ONNX 기반 LLM을 구동할 때 필요한 핵심 팁과 실무 패턴을 정리한 지식 노트입니다.

## 설치와 기본 개념
- 패키지: `@huggingface/transformers`
- 브라우저 실행: ONNX Runtime Web(ORT)을 내부적으로 사용하여 모델을 실행합니다. 별도 ORT 직접 import 불필요(필요 시 `device`/`session_options`로 제어).
- 주요 진입점: `pipeline(task, modelId, opts?)`
  - `task`: `"text-generation"`, `"text2text-generation"`, 등
  - `modelId`: HF Hub의 모델 경로(예: `onnx-community/gemma-3-1b-it-ONNX-GQA`)
  - `opts`: `dtype`, `device`(`'wasm' | 'webgpu'`), `session_options`, `local_files_only`, `revision` 등

## 보안/환경(브라우저)
- 스레드/Simd 가속을 위해 COOP/COEP 권장
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp` (또는 원격 리소스 이슈 시 `credentialless`)
- HTTPS + COOP/COEP 환경에서 SharedArrayBuffer 기반 스레드 사용 가능
- Vite 개발 서버/프록시에 헤더 설정 필요(이미 프로젝트에 설정됨)

## 캐시/스토리지
- 모델/토크나이저는 기본적으로 Cache Storage 사용
  - 기본 캐시 키: `'transformers-cache'`
  - IndexedDB는 환경에 따라 일부 메타/OPFS로 사용될 수 있음
- 옵션 제어: `env` 또는 `pipeline` 옵션
  - `env.allowRemoteModels`, `env.useBrowserCache`, `env.customCache` 등
  - `pipeline(..., { local_files_only: true })`로 오프라인 모드 가능(먼저 캐시 필요)
- 캐시 삭제: Cache Storage 키 삭제 + 필요 시 IndexedDB 삭제(권한/브라우저 지원 확인)

## 장치/백엔드/정밀도
- `device`: `'wasm' | 'webgpu' | 'cpu' | 'auto'` 등(브라우저는 보통 `'wasm'`/`'webgpu'`)
- `session_options`: `{ executionProviders: ['wasm'] }`처럼 EP 지정
- `dtype`: `'fp32' | 'q8' | 'q4' | 'fp16' ...`
  - 모델 리포가 해당 dtype 변형을 제공해야 함(예: `_quantized` = q8)
  - 제공되지 않은 변형을 요청하면 초기화 실패 가능

## 파이프라인 사용법
- 단순 텍스트 입력
```ts
import { pipeline } from '@huggingface/transformers';
const generator = await pipeline('text-generation', 'onnx-community/gemma-3-1b-it-ONNX-GQA', { dtype: 'q8' });
const out = await generator('Hello', { max_new_tokens: 64, do_sample: false });
console.log(out[0].generated_text);
```
- 채팅 형식(예제에 포함)
  - 입력: `[{ role: 'system' | 'user' | 'assistant', content: string }]`
  - 내부에서 `tokenizer.apply_chat_template`로 텍스트 프롬프트 생성
```ts
const messages = [
  { role: 'system', content: '너는 한국어로만 답하는 TRPG 매니저다.' },
  { role: 'user', content: '첫 장면을 묘사해줘.' }
];
const out = await generator(messages, { max_new_tokens: 128 });
console.log(out[0].generated_text.at(-1).content);
```

## 스트리밍 토큰(실시간 출력)
- `TextStreamer` 사용
```ts
import { TextStreamer } from '@huggingface/transformers';
const streamer = new TextStreamer(generator.tokenizer, {
  skip_prompt: true,
  skip_special_tokens: true,
  callback_function: (text) => {
    // 토큰 단위로 UI에 반영
    process.stdout.write(text);
  }
});
const out = await generator(messages, { max_new_tokens: 128, streamer });
```

## 생성 파라미터(GenerationConfig)
- 대표 옵션
  - `max_new_tokens`, `min_new_tokens`
  - `temperature`(샘플링 강도), `top_p`(누적 확률), `top_k`
  - `repetition_penalty`, `no_repeat_ngram_size`
  - `num_beams`(빔 탐색) 등
- `generate()`는 내부적으로 `past_key_values` 캐시를 사용하여 토큰 단위로 반복 실행
- `max_length` vs `max_new_tokens`: 후자가 지정되면 프롬프트 길이를 고려하여 `max_length` 자동 계산

## 토크나이저/템플릿
- `apply_chat_template(conversation, { tokenize, add_generation_prompt, padding, truncation })`
  - 대화 메시지를 모델 템플릿에 맞는 텍스트로 변환
  - 채팅 파이프라인은 자동 적용

## 에러 처리 팁
- 숫자 형태 예외(예: `3436574736`)는 WASM/EP 내부에서 표준 메시지 없이 던지는 경우
  - 원격 리소스 차단/손상/부적합 dtype/환경(스레드/Simd) 문제 가능
  - 네트워크 응답이 HTML/차단 페이지인지 확인(개발자 도구 Network 탭)
  - COEP를 `credentialless`로 완화해 테스트해볼 수 있음
  - 다른 `dtype`으로 시험(q4→q8)
  - Cache/IndexedDB 삭제 후 재시도

## 성능/최적화
- WebAssembly(‘wasm’) 환경에서 스레드/Simd 활성화 시 성능 향상
  - COOP/COEP + HTTPS 필요
- ORT WASM 스레드 수/Simd 플래그는 `env.backends.onnx` 또는 `session_options`로 조정 가능
- 첫 호출 시 모델/토크나이저/세션 초기화 비용 큼 → 워커에서 재사용 권장

## 워커 패턴 권장
- 메인 스레드 UI 블로킹 방지
- 워커 내부에서 `pipeline()` 초기화 및 스트리밍 처리
- 메인 스레드에는 진행 이벤트/토큰/완료/에러만 전송
- 주의: Node 전용 모듈 사용 금지, 브라우저 전용 API만 사용

## 예제 기반 패턴 모음
- “채팅 + 스트리밍” 최소 구현 순서
  1) 워커에서 `pipeline('text-generation', modelId, { dtype, device })` 준비
  2) `TextStreamer`로 토큰 콜백 연결 → `postMessage({ type: 'token', token })`
  3) 완료 시 최종 텍스트 `postMessage({ type: 'done', text })`
  4) 에러/Abort 시 별도 타입으로 통지
- 오프라인 모드(캐시만 사용)
  - `local_files_only: true`로 원격 차단, 미리 캐싱된 리소스만 활용
- 슬라이딩 컨텍스트
  - 토크나이저 `model_max_length` 기준으로 자동 `truncation` 적용
  - 긴 대화는 오래된 메시지 요약/삭제로 토큰 예산 유지

## 체크리스트
- [ ] HTTPS + COOP/COEP 헤더 적용(Vite/프록시)
- [ ] 모델 ID/dtype이 실제 리포에 존재하는지 확인
- [ ] 워커에서 재사용(세션 1개 유지), 메인 스레드 스트리밍 구독
- [ ] 캐시/IndexedDB 정리 루틴 제공(복구용)
- [ ] AbortSignal 연동(사용자 취소 반영)
- [ ] 숫자 예외 시 네트워크/COEP/dtype/캐시 순으로 진단

---
- 추가 자료
  - Transformers.js 문서: https://huggingface.co/docs/transformers.js
  - 소스 파일(참고): `node_modules/@huggingface/transformers/src/pipelines.js`, `src/models.js`, `src/env.js`

