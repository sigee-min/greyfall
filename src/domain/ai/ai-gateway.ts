import { commandRegistry } from './command-registry';
import { parseAICommand, type AICommand } from './ai-router';
// LLM 모듈은 동적 import로 지연 로딩해 초기 번들을 줄입니다.
// 타입은 이 파일에서 별도로 정의해 정적 의존성을 제거합니다.
export type LlmManagerKind = 'hasty' | 'fast' | 'smart';
import { getPersona } from './personas';

// 매니저별 동시 실행 방지용 락 (StrictMode/HMR 중복 호출 대응)
const inflightByManager = new Map<LlmManagerKind, Promise<void>>();

export type AIGatewayParams = {
  manager: LlmManagerKind;
  userInstruction: string;
  contextText?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackChatText?: string;
  timeoutMs?: number;
};

export async function requestAICommand({
  manager,
  userInstruction,
  contextText,
  temperature = 0.5,
  maxTokens = 128,
  fallbackChatText = '채널에 합류했습니다.',
  timeoutMs = 20000
}: AIGatewayParams): Promise<AICommand> {
  // 동적 import로 LLM 런타임 지연 로딩
  const {
    generateQwenChat,
    ensureChatApiReady,
    loadQwenEngineByManager,
    probeChatApiActive
  } = await import('../../llm/qwen-webgpu');
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

  const sys = [
    `당신은 작전 심판자 "${persona.name}"입니다.`,
    ...persona.systemDirectives,
    '가능한 명령과 설명:',
    capabilities,
    '',
    '출력은 반드시 JSON 한 줄로만 작성:',
    '{"cmd": "<명령>", "body": <고정타입>}',
    '각 명령의 body는 고정 타입을 따릅니다(예: chat → string).',
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
  try {
    // 1) 엔진 예열 및 Chat API 준비 보장
    await loadQwenEngineByManager(manager);
    await ensureChatApiReady(10_000);
    // 활성 프로브: 실제 최소 호출이 통과하는지 확인 (타이밍 레이스 방지)
    if (!(await probeChatApiActive(1_000))) {
      for (let i = 0; i < 6; i += 1) {
        await new Promise((r) => setTimeout(r, 250));
        const ok = await probeChatApiActive(750);
        if (ok) break;
      }
    }

    // 2) 본 호출 (+ 트랜지언트 1회 재시도는 generateQwenChat 내부 + 아래 보강)
    // 타임아웃은 실제 생성 단계에만 적용 (사전 준비는 별도 내부 타임아웃으로 보호됨)
    const ctl = new AbortController();
    const timeout = Math.max(1000, Math.min(120000, timeoutMs));
    const timerId = setTimeout(() => ctl.abort('ai-gateway-timeout'), timeout);
    try {
      raw = (
        await generateQwenChat(user, {
          systemPrompt: sys,
          temperature,
          maxTokens,
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
        const timer2 = setTimeout(() => ctl2.abort('ai-gateway-timeout'), Math.min(8000, Math.max(1000, timeoutMs / 2)));
        try {
          raw = (
            await generateQwenChat(user, {
              systemPrompt: sys,
              temperature,
              maxTokens,
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
    release();
    return parsed;
  }
  if (raw) {
    // Received output but could not parse the expected JSON envelope
    const preview = typeof raw === 'string' ? raw.slice(0, 160) : String(raw);
    console.warn('[ai-gateway] Unparseable LLM output; falling back to chat', { preview });
  } else {
    console.warn('[ai-gateway] Empty LLM output; falling back to chat');
  }
  release();
  return { cmd: 'chat', body: { text: fallbackChatText } };
}
