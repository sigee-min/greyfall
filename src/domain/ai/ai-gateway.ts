import { commandRegistry } from './command-registry';
import { parseAICommand, type AICommand } from './ai-router';
// LLM 모듈은 동적 import로 지연 로딩해 초기 번들을 줄입니다.
// 타입은 이 파일에서 별도로 정의해 정적 의존성을 제거합니다.
export type LlmManagerKind = 'hasty' | 'fast' | 'smart';
import { getPersona } from './personas';

// 매니저별 동시 실행 방지용 락 (StrictMode/HMR 중복 호출 대응)
const inflightByManager = new Map<LlmManagerKind, Promise<void>>();
// Track first successful generation per manager to extend cold-start timeout
const firstGenDoneByManager = new Map<LlmManagerKind, boolean>();

export type AIGatewayParams = {
  manager: LlmManagerKind;
  userInstruction: string;
  contextText?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackChatText?: string;
  timeoutMs?: number;
  twoPhase?: boolean;
};

export async function requestAICommand({
  manager,
  userInstruction,
  contextText,
  temperature = 0.5,
  maxTokens,
  fallbackChatText = '채널에 합류했습니다.',
  timeoutMs
}: AIGatewayParams): Promise<AICommand> {
  const ALLOWED_CMDS = new Set(['chat', 'mission.start', 'llm.readyz']);
  const envMax = Number((import.meta as any).env?.VITE_LLM_MAX_TOKENS);
  const maxTok = Number.isFinite(envMax) && envMax > 0 ? Math.min(2048, Math.max(32, envMax)) : 128;
  const envTimeout = Number((import.meta as any).env?.VITE_LLM_TIMEOUT_MS);
  const envColdTimeout = Number((import.meta as any).env?.VITE_LLM_COLD_TIMEOUT_MS);
  const twoPhaseEnv = String((import.meta as any).env?.VITE_LLM_TWO_PHASE ?? '').toLowerCase();
  const useTwoPhase = Boolean((arguments[0] as AIGatewayParams)?.twoPhase ?? (twoPhaseEnv === '1' || twoPhaseEnv === 'true'));
  const defaultTimeout = (() => {
    if (Number.isFinite(envTimeout) && envTimeout! > 0) return Math.min(120_000, Math.max(5_000, envTimeout!));
    if (manager === 'hasty') return 35_000;
    if (manager === 'fast') return 45_000;
    return 60_000;
  })();
  const effectiveTimeout = Math.max(1_000, Math.min(120_000, timeoutMs ?? defaultTimeout));
  const coldStartTimeout = (() => {
    if (Number.isFinite(envColdTimeout) && envColdTimeout! > 0) return Math.min(180_000, Math.max(20_000, envColdTimeout!));
    // generous default for first token compile on slower GPUs (Windows)
    return 90_000;
  })();
  // 동적 import로 LLM 런타임 지연 로딩
  const {
    generateChat,
    ensureChatApiReady,
    loadEngineByManager,
    probeChatApiActive
  } = await import('../../llm/webllm-engine');
  // 0) 동일 매니저 키로 줄 세워 실행 (중복·동시 호출 방지)
  if (!inflightByManager.has(manager)) {
    inflightByManager.set(manager, Promise.resolve());
  }
  const prev = inflightByManager.get(manager)!;
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  inflightByManager.set(manager, prev.then(() => gate));
  try {
    await prev; // 이전 요청 완료까지 대기
  } catch {
    // 이전 요청 에러는 게이트웨이 로직에는 영향 없음
  }
  const persona = getPersona(manager);
  const capabilities = commandRegistry
    .list()
    .map((c) => `- ${c.cmd}: ${c.doc}`)
    .join('\n');
  const allowedList = commandRegistry.list().map((c) => c.cmd);
  const allowedCmds = allowedList.join(' | ');
  const ALLOWED = new Set(allowedList);

  const sys = [
    `당신은 작전 심판자 "${persona.name}"입니다.`,
    ...persona.systemDirectives,
    '가능한 명령과 설명:',
    capabilities,
    '',
    '모든 응답과 명령 body 문자열은 반드시 한국어로 작성하세요.',
    `허용 명령(cmd): ${allowedCmds}`,
    '최종적으로 아래 형식의 JSON 한 줄로 작성하세요:',
    '{"cmd": "<명령>", "body": <고정타입>}',
    '각 명령의 body는 고정 타입을 따릅니다(예: chat → string).',
    '반드시 위 목록의 명령(cmd) 중 하나만 선택하세요. 목록에 정확히 매칭되지 않으면 chat을 사용하세요.',
  ].join('\n');

  const user = [
    userInstruction,
    contextText ? '' : undefined,
    contextText ? '맥락:' : undefined,
    contextText ?? undefined
  ]
    .filter(Boolean)
    .join('\n');

  let raw = '';
  // Optional two-phase pipeline: 1) choose cmd, 2) fill body
  if (useTwoPhase) {
    try {
      await loadEngineByManager(manager);
      await ensureChatApiReady(10_000);
      if (!(await probeChatApiActive(1_000))) {
        for (let i = 0; i < 6; i += 1) {
          await new Promise((r) => setTimeout(r, 250));
          const ok = await probeChatApiActive(750);
          if (ok) break;
        }
      }
      const sysCmd = [
        `당신은 작전 심판자 \"${persona.name}\"입니다.`,
        ...persona.systemDirectives,
        `허용 명령(cmd): ${allowedCmds}`,
        '아래 형식의 JSON 한 줄로만 출력하세요:',
        '{"cmd":"<명령>"}',
        '설명이나 추가 텍스트는 쓰지 마세요.'
      ].join('\\n');
      const ctl1 = new AbortController();
      const t1 = setTimeout(() => ctl1.abort('ai-gateway-two-phase-cmd'), Math.min(10_000, Math.max(2_000, (timeoutMs ?? defaultTimeout) / 3)));
      let rawCmd = '';
      try {
        rawCmd = (
          await generateChat(user, { systemPrompt: sysCmd, temperature: 0, maxTokens: 24, signal: ctl1.signal })
        ).trim();
      } finally { clearTimeout(t1); }
      const chosen = parseAICommand(rawCmd);
      if (chosen && ALLOWED.has(chosen.cmd)) {
        let bodyHint = '';
        if (chosen.cmd === 'chat') bodyHint = 'body는 string (메시지 텍스트) 입니다.';
        else if (chosen.cmd === 'llm.readyz') bodyHint = 'body는 string, 임의의 값이어도 됩니다.';
        else if (chosen.cmd === 'mission.start') bodyHint = 'body는 비워도 됩니다(null 또는 빈 객체).';
        const sysBody = [
          `당신은 작전 심판자 \"${persona.name}\"입니다.`,
          ...persona.systemDirectives,
          `선택한 명령(cmd): ${chosen.cmd}`,
          bodyHint,
          '아래 형식의 JSON 한 줄로만 출력하세요:',
          '{"cmd":"<명령>","body":<고정타입>}'
        ].join('\\n');
        const ctl2 = new AbortController();
        const t2 = setTimeout(() => ctl2.abort('ai-gateway-two-phase-body'), Math.min(14_000, Math.max(3_000, (timeoutMs ?? defaultTimeout) / 2)));
        try {
          raw = (
            await generateChat(user, { systemPrompt: sysBody, temperature, maxTokens: maxTokens ?? maxTok, signal: ctl2.signal })
          ).trim();
        } finally { clearTimeout(t2); }
        const out = parseAICommand(raw);
        if (out && ALLOWED.has(out.cmd)) {
          firstGenDoneByManager.set(manager, true);
          release();
          return out;
        }
      }
      // If two-phase failed, fall through to single-shot below
    } catch {}
  }
  try {
    // 1) 엔진 예열 및 Chat API 준비 보장
    await loadEngineByManager(manager);
    await ensureChatApiReady(10_000);
    // 활성 프로브: 실제 최소 호출이 통과하는지 확인 (타이밍 레이스 방지)
    if (!(await probeChatApiActive(1_000))) {
      for (let i = 0; i < 6; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        const ok = await probeChatApiActive(750);
        if (ok) break;
      }
    }

    // 2) 본 호출 (+ 트랜지언트 1회 재시도는 generateChat 내부 + 아래 보강)
    // 타임아웃은 실제 생성 단계에만 적용 (사전 준비는 별도 내부 타임아웃으로 보호됨)
    const ctl = new AbortController();
    const isFirstGen = !firstGenDoneByManager.get(manager);
    const genTimeout = isFirstGen ? Math.max(effectiveTimeout, coldStartTimeout) : effectiveTimeout;
    const timerId = setTimeout(() => ctl.abort('ai-gateway-timeout'), genTimeout);
    try {
      raw = (
        await generateChat(user, {
          systemPrompt: sys,
          temperature,
          maxTokens: maxTokens ?? maxTok,
          signal: ctl.signal
        })
      ).trim();
    } finally {
      clearTimeout(timerId);
    }
  } catch (e) {
    // Log error for visibility, then fall back to a safe command to keep UX responsive.
    const message = e instanceof Error ? e.message : String(e);
    // Avoid logging full prompt to reduce noise/PII; include minimal context.
    const isTransient = /reading 'engine'|not a function/i.test(message);
    const log = isTransient ? console.debug : console.error;
    log('[ai-gateway] LLM request failed; using fallback', {
      manager,
      temperature,
      maxTokens,
      error: message
    });
    // 트랜지언트면 짧게 한 번 더 준비 대기 후 재시도
    if (isTransient) {
      try {
        await ensureChatApiReady(2_000);
        if (!(await probeChatApiActive(1_000))) {
          await new Promise((r) => setTimeout(r, 300));
        }
        // 재시도 시에도 생성 단계에만 단기 타임아웃 적용
        const ctl2 = new AbortController();
        const timer2 = setTimeout(
          () => ctl2.abort('ai-gateway-timeout'),
          Math.min(12_000, Math.max(1_000, (timeoutMs ?? defaultTimeout) / 2))
        );
        try {
          raw = (
            await generateChat(user, {
              systemPrompt: sys,
              temperature,
              maxTokens: maxTokens ?? maxTok,
              signal: ctl2.signal
            })
          ).trim();
        } finally {
          clearTimeout(timer2);
        }
      } catch {
        // 두 번째도 실패하면 폴백으로 진행
      }
    }
  }
  const parsed = parseAICommand(raw);
  if (parsed) {
    firstGenDoneByManager.set(manager, true);
    // Enforce allowed command set; coerce unknown to chat to keep UX smooth
    if (!ALLOWED.has(parsed.cmd)) {
      // One-shot repair: ask the model to map to allowed commands using previous output as context
      try {
        const ctlFix = new AbortController();
        const timerFix = setTimeout(() => ctlFix.abort('ai-gateway-repair-timeout'), Math.min(8000, effectiveTimeout));
        const fixUser = [
          '이전 출력의 의도를 유지하되, 허용 명령(cmd) 중 하나로 선택해 JSON 한 줄로만 다시 출력하세요.',
          `허용 명령(cmd): ${allowedCmds}`,
          '이전 출력:',
          JSON.stringify(parsed)
        ].join('\n');
        const fixed = (
          await generateChat(fixUser, {
            systemPrompt: sys,
            temperature: 0,
            maxTokens: 64,
            signal: ctlFix.signal
          })
        ).trim();
        clearTimeout(timerFix);
        const reparsed = parseAICommand(fixed);
        if (reparsed && ALLOWED.has(reparsed.cmd)) {
          release();
          return reparsed;
        }
      } catch {}
      // Fallback: downgrade to chat
      const text = typeof parsed.body === 'string' && parsed.body.trim() ? parsed.body.trim() : fallbackChatText;
      release();
      return { cmd: 'chat', body: text };
    }
    release();
    return parsed;
  }
  let bodyText = fallbackChatText;
  if (raw) {
    firstGenDoneByManager.set(manager, true);
    // Received output but could not parse the expected JSON envelope — salvage as chat text
    const preview = typeof raw === 'string' ? raw.slice(0, 160) : String(raw);
    console.warn('[ai-gateway] Unparseable LLM output; falling back to chat', { preview });
    // Keep it simple: no regex cleanup since model outputs pure JSON now
    const trimmed = String(raw).trim();
    if (trimmed) bodyText = trimmed.slice(0, 400);
  } else {
    console.warn('[ai-gateway] Empty LLM output; falling back to chat');
  }
  release();
  return { cmd: 'chat', body: bodyText };
}
