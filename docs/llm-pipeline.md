# Greyfall LLM Pipeline Architecture

이 문서는 Greyfall 콘솔이 TRPG 보조 모델을 호출하는 방식을 정리고, 향후 파인튜닝과 노드 확장 시 따라야 할 원칙을 설명합니다.

## 1. 전체 흐름 요약

1. **코드가 상황을 분석**하여 어떤 요청 타입(`request_type`)을 사용할지 결정한다.  
   - 예: 로비 브리핑 → `briefing`, 규칙 질의 → `rules`, 일반 대화 → `chat`.
2. 요청 정보는 `request_type`, `actor_id`, `user_instruction`, 필요 시 `context` 필드로 구성해 LLM 요청 API에 전달한다.
3. 코드가 **요청 타입에 대응하는 노드**를 고르고, 해당 노드에 필요한 시스템/유저 프롬프트를 자동으로 구성한다.
4. **LLM은 노드가 요구하는 텍스트만 생성**한다. 상태 전환, 명령 실행 여부 등은 모두 코드에서 처리한다.
5. 노드를 연결 리스트처럼 이어 붙여 **파이프라인을 구성**한다. 각 노드는 한 번에 한 가지 작업만 수행한다.

> 핵심 철학: “명령 선택과 흐름 제어는 코드에서, 텍스트 생성은 LLM에서.”  
> LLM은 최소한의 입력으로 단일 책임을 수행하도록 설계한다.

## 2. 현재 구현된 노드

| 노드 ID      | 역할 요약                     | 입력 파라미터 (예시)                        |
| ------------ | ------------------------------ | ------------------------------------------- |
| `chat.basic` | 일반 대화/장면 서술 등 단문 생성 | `persona`, `userSuffix` (맥락·채팅 로그 등) |

- `chat.basic`은 한국어로 간결한 텍스트를 생성하며, 파이프라인에서 전달한 `persona`/`userSuffix`만 활용한다.  
- 향후 `rules.answer`, `mission.start` 등 추가 노드도 동일한 패턴으로 확장한다. (각 노드는 단일 책임)

## 3. 파이프라인 실행 구조

```
코드에서 request_type 결정  ──>  해당 노드 호출 (예: chat.basic)
```

1. 애플리케이션 로직이 현재 상황에 맞는 `request_type`을 결정한다.  
2. `actor_id`, `user_instruction`, (필요 시) `context`를 포함한 요청을 구성해 노드를 호출한다.  
3. 노드는 내부적으로 정의된 시스템/유저 프롬프트를 사용해 LLM을 호출하고, 결과를 `ctx.scratch`에 기록한다.

## 4. 파인튜닝을 위한 데이터 스키마

### 4.1 샘플 구조 (JSONL)

```json
{
  "request_type": "briefing",
  "system_prompt": "You are the Greyfall TRPG host.",
  "user_prompt": "현재 상황...\n플레이어 요청...",
  "target_response": "브리핑 문단",
  "metadata": {
    "tone_dials": ["grit", "mystic"],
    "locale": "ko",
    "source": "playtest_2025-09-14"
  }
}
```

- `request_type` 는 노드/역할을 명확히 구분해 준다.  
- `system_prompt` 는 **역할·언어·포맷 같은 최소 요구사항**만 포함한다.  
- `user_prompt` 는 노드가 받은 입력(장면 상태, 플레이어 요청 등)을 그대로 담는다.  
- `target_response` 는 LLM이 생성해야 할 텍스트.  
- `metadata` 는 톤, 출처, 언어 등을 자유롭게 확장 가능.

### 4.2 수집/정제 가이드

1. 세션/테스트 로그에서 노드별 입력·출력을 캡처한다.  
2. 개인정보/민감 표현 필터링.  
3. 중복/버그 응답 제거, 규칙 위반 수동 교정.  
4. 롱폼 컨텍스트는 파이프라인이 분할하므로 샘플은 1k 토큰 이하 유지.  
5. 언어코드(`ko`, `en`)와 톤(`grit`, `heroic`, `mystic`)을 명시해 멀티턴 조정이 가능하도록 한다.

### 4.3 학습 전략

- LoRA/QLoRA로 1B 모델을 튜닝하되, 과업을 작게 쪼개 `task` 별(예: `plan`, `narrate`, `chat`) 샘플을 충분히 확보한다.  
- Instruction tuning 이후, 필요 시 preference dataset(`good/bad`) 기반 RLHF/DPO를 추가.  
- 검증용 홀드아웃을 `plan`, `narrate`, `chat` 등으로 균형 있게 구성.

## 5. 확장 아이디어

- **규칙 버전 관리**: `ruleset_rev` 필드로 룰북 업데이트 대응.  
- **멀티 에이전트**: `actor_role`을 추가해 GM/플레이어 보조를 분리.  
- **장기 기억**: `session_memory` 필드로 이전 세션 요약을 전달.  
- **안전 가드레일**: `safety_tag`(예: `/pause`) 샘플을 포함해 거절/완화 응답 학습.  
 
- **자동 검증**: 연결 리스트 파이프라인을 그대로 돌리는 시뮬레이터 테스트로 회귀 검증.  
- **실시간 피드백**: 운영 중 로그에 `good`/`bad` 태그를 붙여 재학습 데이터 풀을 상시 확보.

## 6. 운영 원칙 요약

1. **노드 최소 책임**: 각 노드는 한 기능만 수행하며, 파라미터 수도 최소화한다.  
2. **명령 결정은 코드**: 흐름 제어/명령 선택은 런타임 로직이 담당한다.  
3. **LLM은 텍스트 생성에 집중**: 파인튜닝 데이터도 해당 노드가 생성해야 하는 텍스트만 학습시킨다.  
4. **시스템 프롬프트는 간결하게**: “역할·언어·포맷” 정도만 담고 나머지는 데이터에서 학습한다.  
5. **확장 가능성 고려**: 새 노드를 추가할 때는 동일한 패턴을 재사용해 유지보수성을 확보한다.

이 원칙을 따르면 현재 파이프라인 구조를 유지하면서도 튜닝/확장에 필요한 문서화가 완성됩니다.

### Request Type 카탈로그 요약
- Core: `chat`, `intent.plan`, `result.narrate`
- Scene: `scene.brief`, `scene.detail`
- Rules: `rules.extract`, `rules.narrate`
- Summary: `turn.summarize`, `session.summarize`
- NPC: `npc.reply`, `npc.name`

각 타입의 상세 입출력/검증 규격과 JSON 예시는 `docs/llm-usage-spec.md` 8–10장을 참조하세요.

---

## 7. TRPG 의도/판정/효과/서술 아키텍처(1B 최적화)

1B에서 신뢰도를 확보하기 위해 LLM은 “의도(plan)”와 “서술(narrate)”에만 집중하고, 주사위/수치/효과 적용은 코드가 수행합니다.

- LLM: 작은 구조화 출력(plan)과 짧은 자연어 서술(narrate)
- 코드: 판정/주사위/HP·상태 적용, 결과 로그 생성

권장 파이프라인(개념)
- `intent.plan` → `action.apply(code)` → `result.narrate` (+ 실패 시 `no_action`/축소 폴백)

검증 원칙
- `plan`: 스키마·화이트리스트 강제, 숫자/판정 결과/HP 변경 금지
- `narrate`: 제공된 `Rolls/Effects` 외 사실·수치 언급 금지, 길이/로케일/금칙어 검사

데이터셋 태스크 필드
- `task: 'plan' | 'narrate' | 'chat'`

## 8. 데이터 통신 규칙(컨벤션/규격)

게이트웨이가 시스템 프롬프트에 다음 섹션을 주입하고, 유저 입력은 user로 전달합니다. 섹션 제목은 고정 문자열을 사용합니다.

- 섹션 제목
  - `맥락`: 장면/상황 요약(선택)
  - `최근 채팅(최대 10개)`: `- author(role): message` 형식 목록
  - `액터 목록`(선택): `id role=... name=... hp=cur/max status=[...]`
  - `지형/위험 요소`(선택): `hazardId: dice effect=hp.sub|status.add(...)
  - `Rolls`(코드 전용): `skill d20+mod vs DC=.. → total (pass|fail)`
  - `Effects`(코드 전용): `actorId hp.sub N`, `status.add X (2r)`

의도(plan) 출력(한 줄 JSON 예시)
```
{"action":"sneak_move","checks":["stealth"],"hazards":["thorns"],"targets":["p:alice"],"meta":{"reason":"도주"}}
```
- 모든 값은 현재 씬의 화이트리스트(actions/checks/hazards/targets)에서만 선택합니다. 숫자/주사위/HP 변경은 금지합니다.

서술(narrate) 출력
- 1–3문장 자연어. 반드시 `Rolls/Effects` 로그만 인용해 수치/사실을 기술합니다.

로케일(locale)
- 게이트웨이는 `locale: 'ko' | 'en'`을 엔진 옵션과 모니터 메타에 포함하며, 데이터셋에도 저장합니다.

실패/폴백
- `plan` 파싱/검증 실패 → 1회 보정/축소 → `no_action`
- `narrate` 위반 → 1회 축소 재생성 → 1문장 폴백
