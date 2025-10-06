// Keep runtime deps lazily loaded to minimize initial bundle size.
import type { ChatOptions } from '../../../llm/webllm-engine';
import type { LlmManagerKind } from '../../../llm/webllm-engine';

type LlmOps = {
  generateChat: (prompt: string, options?: ChatOptions) => Promise<string>;
  ensureChatApiReady: (timeoutMs?: number) => Promise<void>;
  loadEngineByManager: (manager: LlmManagerKind) => Promise<unknown>;
  probeChatApiActive: (timeoutMs?: number) => Promise<boolean>;
};

async function loadOps(): Promise<LlmOps> {
  const mod = await import('../../../llm/webllm-engine');
  return {
    generateChat: mod.generateChat,
    ensureChatApiReady: mod.ensureChatApiReady,
    loadEngineByManager: mod.loadEngineByManager,
    probeChatApiActive: mod.probeChatApiActive
  } satisfies LlmOps;
}

export async function ensureRuntimeReady(manager: LlmManagerKind): Promise<void> {
  const { loadEngineByManager, ensureChatApiReady, probeChatApiActive } = await loadOps();
  await loadEngineByManager(manager);
  await ensureChatApiReady(1_800_000);
  // Actively probe minimal call path to avoid racy readiness under worker boundary
  if (!(await probeChatApiActive(1_000))) {
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250));
      // eslint-disable-next-line no-await-in-loop
      const ok = await probeChatApiActive(750);
      if (ok) break;
    }
  }
}

export async function generateWithTimeout(
  user: string,
  opts: { systemPrompt: string; temperature: number; maxTokens: number; timeoutMs: number }
): Promise<string> {
  const { generateChat } = await loadOps();
  const ctl = new AbortController();
  const timerId = setTimeout(() => ctl.abort('ai-gateway-timeout'), opts.timeoutMs);
  try {
    const raw = (
      await generateChat(user, {
        systemPrompt: opts.systemPrompt,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        signal: ctl.signal
      })
    ).trim();
    return raw;
  } finally {
    clearTimeout(timerId);
  }
}

export async function transientRetryGenerate(
  user: string,
  opts: { systemPrompt: string; temperature: number; maxTokens: number; timeoutMs: number }
): Promise<string> {
  try {
    return await generateWithTimeout(user, opts);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const isTransient = /reading 'engine'|not a function/i.test(message);
    if (!isTransient) throw e;
    const { ensureChatApiReady, probeChatApiActive } = await loadOps();
    try {
      await ensureChatApiReady(2_000);
      if (!(await probeChatApiActive(1_000))) {
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch {}
    return await generateWithTimeout(user, { ...opts, timeoutMs: Math.min(12_000, Math.max(1_000, Math.floor(opts.timeoutMs / 2))) });
  }
}
