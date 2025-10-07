// Keep runtime deps lazily loaded to minimize initial bundle size.
import type { ChatOptions } from '../../../llm/llm-engine';
import type { LlmManagerKind } from '../../../llm/llm-engine';

type LlmOps = {
  generateChat: (prompt: string, options?: ChatOptions) => Promise<string>;
  ensureChatApiReady: (manager: LlmManagerKind, timeoutMs?: number) => Promise<void>;
  loadEngineByManager: (manager: LlmManagerKind) => Promise<unknown>;
  probeChatApiActive: (timeoutMs?: number) => Promise<boolean>;
  resetEngine: (reason?: string) => void;
};

async function loadOps(): Promise<LlmOps> {
  const mod = await import('../../../llm/llm-engine');
  return {
    generateChat: mod.generateChat,
    ensureChatApiReady: mod.ensureChatApiReady,
    loadEngineByManager: mod.loadEngineByManager,
    probeChatApiActive: mod.probeChatApiActive,
    resetEngine: mod.resetEngine
  } satisfies LlmOps;
}

export async function ensureRuntimeReady(manager: LlmManagerKind): Promise<void> {
  const { loadEngineByManager, ensureChatApiReady, probeChatApiActive, resetEngine } = await loadOps();
  let attempt = 0;
  while (attempt < 2) {
    try {
      await loadEngineByManager(manager);
      await ensureChatApiReady(manager, 1_800_000);
      if (!(await probeChatApiActive(1_000))) {
        for (let i = 0; i < 6; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 250));
          // eslint-disable-next-line no-await-in-loop
          const ok = await probeChatApiActive(750);
          if (ok) break;
        }
      }
      return;
    } catch (err) {
      attempt += 1;
      if (attempt >= 2) throw err;
      resetEngine('ensureRuntimeReady:retry');
      await new Promise((r) => setTimeout(r, 400));
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
    if (DEBUG) console.debug(`[llm-exec] generateChat.begin temp=${opts.temperature} maxTokens=${opts.maxTokens}`);
    const raw = (
      await generateChat(user, {
        systemPrompt: opts.systemPrompt,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        signal: ctl.signal
      })
    ).trim();
    if (DEBUG) console.debug(`[llm-exec] generateChat.done chars=${raw.length}`);
    return raw;
  } finally {
    clearTimeout(timerId);
  }
}

export async function transientRetryGenerate(
  manager: LlmManagerKind,
  user: string,
  opts: { systemPrompt: string; temperature: number; maxTokens: number; timeoutMs: number }
): Promise<string> {
  try {
    return await generateWithTimeout(user, opts);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const isTransient = /reading 'engine'|not a function/i.test(message);
    if (!isTransient) throw e;
    const { ensureChatApiReady, probeChatApiActive, resetEngine, loadEngineByManager } = await loadOps();
    try {
      resetEngine('transientRetry');
      await new Promise((r) => setTimeout(r, 200));
      await loadEngineByManager(manager);
      await ensureChatApiReady(manager, 2_000);
      if (!(await probeChatApiActive(1_000))) {
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch {}
    return await generateWithTimeout(user, { ...opts, timeoutMs: Math.min(12_000, Math.max(1_000, Math.floor(opts.timeoutMs / 2))) });
  }
}

// Simple messages-based generation for Transformers.js branch.
// NOTE: For WebLLM branch, implement a TODO using chat.completions.create-compatible path later.
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function generateMessagesWithTimeout(
  manager: LlmManagerKind,
  messages: ChatMessage[],
  opts: { temperature: number; maxTokens: number; timeoutMs: number }
): Promise<string> {
  // Merge into (systemPrompt, user) pair for our current CPU (Transformers.js) adapter
  const systems = messages.filter((m) => m.role === 'system').map((m) => m.content.trim());
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content.trim());
  const systemPrompt = systems.join('\n').trim() || 'You are a helpful assistant.';
  const user = users.join('\n\n').trim();
  if (DEBUG) console.debug(`[llm-exec] messages systems=${systems.length} users=${users.length} timeout=${opts.timeoutMs}`);
  try {
    return await generateWithTimeout(user, {
      systemPrompt,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      timeoutMs: opts.timeoutMs
    });
  } catch (err) {
    if (DEBUG) console.warn(`[llm-exec] generate failed, retrying once reason=${String((err as any)?.message || err)}`);
    return transientRetryGenerate(manager, user, {
      systemPrompt,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      timeoutMs: opts.timeoutMs
    });
  }
}
const DEBUG = Boolean((import.meta as any).env?.VITE_LLM_DEBUG);
