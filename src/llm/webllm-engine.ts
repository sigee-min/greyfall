import { CreateWebWorkerMLCEngine } from '@mlc-ai/web-llm';
import { MODEL_OVERRIDES, type ModelRegistryConfig } from './model-config';

export type LlmManagerKind = 'hasty' | 'fast' | 'smart';
type ModelProfile = { id: string; appConfig?: Record<string, unknown> };
// Curated models (Qwen removed):
// - High tier: Llama 3.1 8B Instruct (q4f16_1)
// - Mid tier: Llama 3.2 3B Instruct (q4f16_1)
// - Low tier: SmolLM2 1.7B Instruct (q4f16_1)
const LLAMA31_8B_Q4F16_1: ModelProfile = { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC' };
const LLAMA32_3B_Q4F16_1: ModelProfile = { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC' };
const SMOLLM2_1_7B_Q4F16_1: ModelProfile = { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC' };
function envOverride(kind: LlmManagerKind): string | null {
  const env = (import.meta as any).env || {};
  const key = kind === 'hasty' ? 'VITE_LLM_MODEL_ID_HASTY' : kind === 'fast' ? 'VITE_LLM_MODEL_ID_FAST' : 'VITE_LLM_MODEL_ID_SMART';
  const id = env?.[key];
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function codeOverride(kind: LlmManagerKind): ModelProfile[] | null {
  const cfg: ModelRegistryConfig | undefined = MODEL_OVERRIDES[kind];
  if (!cfg || !cfg.ids || cfg.ids.length === 0) return null;
  const appConfig = cfg.appConfig;
  return cfg.ids.map((id) => ({ id, appConfig }));
}

function resolveProfiles(kind: LlmManagerKind): ModelProfile[] {
  // 1) Code-level override wins
  const code = codeOverride(kind);
  if (code && code.length > 0) return code;
  // 2) Env override (still supported)
  const override = envOverride(kind);
  if (override) return [{ id: override }];
  if (kind === 'hasty') {
    // Low → Mid → High
    return [SMOLLM2_1_7B_Q4F16_1, LLAMA32_3B_Q4F16_1, LLAMA31_8B_Q4F16_1];
  }
  if (kind === 'fast') {
    // Mid → Low → High
    return [LLAMA32_3B_Q4F16_1, SMOLLM2_1_7B_Q4F16_1, LLAMA31_8B_Q4F16_1];
  }
  // High → Mid → Low
  return [LLAMA31_8B_Q4F16_1, LLAMA32_3B_Q4F16_1, SMOLLM2_1_7B_Q4F16_1];
}

export type ChatOptions = {
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (token: string, tokenIndex: number) => void;
};

type WebLLMProgress = { text?: string; progress?: number };
type Phase = 'prepare' | 'download' | 'load-lib' | 'compile' | 'engine-ready' | 'chat-ready';

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function segment(progress: number | undefined, start: number, end: number, last: number): number {
  if (typeof progress === 'number' && !Number.isNaN(progress)) {
    const p = start + clamp01(progress) * (end - start);
    return Math.max(last, Math.min(0.9, p));
  }
  return Math.max(last, Math.min(0.9, last + 0.01));
}

type WebLLMChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type WebLLMCompletionRequest = {
  messages: WebLLMChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
  onNewToken?: (token: string, progress?: WebLLMProgress, metadata?: { token_id: number }) => void;
  // OpenAI-compatible extra fields supported by WebLLM
  response_format?: { type: 'json_object' | string };
};

// Compatibility types for different WebLLM chat APIs
type WebLLMChatCompat = {
  // Legacy API
  completion?: (request: WebLLMCompletionRequest) => Promise<{ output_text: string }>;
  // Newer, OpenAI-like API shape
  completions?: {
    create: (
      request: Omit<WebLLMCompletionRequest, 'onNewToken'>
    ) => Promise<
      | { output_text?: string; choices?: Array<{ message?: { content?: string }; text?: string }> }
      | AsyncIterable<unknown>
    >;
  };
};

type WebLLMEngine = {
  chat: WebLLMChatCompat;
};

// Runtime is provided by the web worker engine; no explicit runtime type/import needed.

// Use global singleton to survive HMR/StrictMode double mounts
type GlobalWebLLMState = { enginePromise: Promise<WebLLMEngine> | null; initialising: boolean };
const GLOBAL_KEY = '__greyfall_webllm_singleton__';
const g = globalThis as Record<string, unknown>;
if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { enginePromise: null, initialising: false } satisfies GlobalWebLLMState;
function getState(): GlobalWebLLMState {
  return g[GLOBAL_KEY] as GlobalWebLLMState;
}
function getEnginePromise() { return getState().enginePromise; }
function setEnginePromise(p: Promise<WebLLMEngine> | null) { getState().enginePromise = p; }
function getInitialising() { return getState().initialising; }
function setInitialising(v: boolean) { getState().initialising = v; }

export async function loadEngineByManager(
  manager: LlmManagerKind,
  onProgress?: (report: WebLLMProgress) => void
): Promise<WebLLMEngine> {
  if (typeof window === 'undefined') {
    throw new Error('WebLLM WebGPU runtime is only available in the browser environment.');
  }

  if (!window.isSecureContext) {
    throw new Error('WebGPU는 보안(HTTPS) 환경에서만 동작합니다. HTTPS 페이지로 접속해 주세요.');
  }

  const nav = navigator as Navigator & { gpu?: unknown };
  if (!('gpu' in nav) || !nav.gpu) {
    throw new Error('이 브라우저는 WebGPU를 지원하지 않습니다. Chrome 113+ (chrome://flags/#enable-unsafe-webgpu) 또는 최신 Edge에서 시도해 주세요.');
  }

  // Prevent racy double-initialisation under StrictMode/HMR by
  // setting a single shared promise that all callers await.
  if (getEnginePromise()) return getEnginePromise()!;
  if (getInitialising()) {
    // Busy-wait with micro-sleeps until the shared promise is set
    // (should only be a few ms window)
    while (!getEnginePromise()) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(5);
    }
    return getEnginePromise()!;
  }
  setInitialising(true);
  const attempts = resolveProfiles(manager);
  const debug = Boolean((import.meta as any).env?.VITE_LLM_DEBUG);
  let lastP = 0;
  const wrappedProgress = (report: WebLLMProgress) => {
    try {
      const t = (report.text || '').toLowerCase();
      let phase: Phase = 'prepare';
      let p = lastP;
      let text = report.text ?? '엔진 초기화 중';
      if (/download|fetch|cache|artifact|weight/.test(t)) {
        phase = 'download';
        text = '모델 파일 내려받는 중';
        p = segment(report.progress, 0.05, 0.55, lastP);
      } else if (/wasm|model lib|library|load lib|load model/.test(t)) {
        phase = 'load-lib';
        text = '모델 라이브러리 로드 중';
        p = segment(report.progress, 0.55, 0.7, lastP);
      } else if (/compile|build|graph|kernel/.test(t)) {
        phase = 'compile';
        text = '그래프 컴파일 중';
        p = segment(report.progress, 0.7, 0.9, lastP);
      } else {
        // Fallback: map overall progress into 0.05..0.9 window
        text = report.text || '엔진 초기화 중';
        p = segment(report.progress, 0.05, 0.9, lastP);
      }
      lastP = p;
      onProgress?.({ text, progress: p });
      if (debug) console.debug('[webllm] progress', { phase, text, p, raw: report });
    } catch {}
  };

  setEnginePromise((async () => {
    let lastError: unknown;
    for (const profile of attempts) {
      try {
        console.info('[webllm] trying model', { id: profile.id });
        const worker = new Worker(new URL('./mlc-worker.ts', import.meta.url), { type: 'module' });
        // Surface worker-level errors (네트워크/CORS/MIME 등) 관측 강화
        worker.addEventListener('error', (ev) => {
          console.error('[webllm] worker error', ev);
        });
        worker.addEventListener('messageerror', (ev) => {
          console.error('[webllm] worker messageerror', ev);
        });
        const options: Record<string, unknown> = { initProgressCallback: wrappedProgress };
        if (profile.appConfig) {
          options.appConfig = profile.appConfig;
          if (debug) console.info('[webllm] using custom appConfig');
        }
        const eng = (await (CreateWebWorkerMLCEngine(
          worker as unknown as Worker,
          profile.id,
          options as any
        ) as any)) as WebLLMEngine;
        console.info('[webllm] model initialised', { id: profile.id });
        try { onProgress?.({ text: '엔진 초기화 완료', progress: Math.max(0.92, (lastP || 0)) }); } catch {}
        return eng;
      } catch (error) {
        console.warn('[webllm] model init failed', { id: profile.id, error });
        lastError = error;
      }
    }
    throw normaliseEngineError(lastError);
  })());

  try {
    return await getEnginePromise()!;
  } finally {
    setInitialising(false);
  }
}

// Allow UI to force a fresh initialisation attempt if previous one got stuck
export function resetEngine() { setEnginePromise(null); }

export async function generateChat(prompt: string, options: ChatOptions = {}) {
  const {
    systemPrompt = 'You are a seasoned guide who offers concise, practical suggestions.',
    temperature = 0.7,
    topP = 0.9,
    maxTokens = 512,
    signal,
    onToken
  } = options;

  // Assume engine has already been initialised by manager selection path
  let engine = await (getEnginePromise() ?? loadEngineByManager('smart'));

  // Guard against partially-initialised or incompatible engine shape by waiting, not resetting
  if (!isChatApiAvailable(engine)) {
    try {
      await waitForChatApi(engine, 10000);
    } catch (err) {
      throw normaliseEngineError(err);
    }
  }

  const request: WebLLMCompletionRequest = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
    // Encourage strict JSON envelope
    response_format: { type: 'json_object' },
    stream: Boolean(onToken),
    onNewToken: onToken
      ? (token: string, progress?: WebLLMProgress, metadata?: { token_id: number }) => {
          void progress;
          onToken(token, metadata?.token_id ?? 0);
        }
      : undefined
  };

  // Local abort handling (do not pass AbortSignal across worker boundary)
  let aborted = false;
  if (signal) {
    if (signal.aborted) aborted = true;
    else signal.addEventListener('abort', () => (aborted = true), { once: true });
  }

  const task = (async () => {
    // One-time recovery on transient TypeError (e.g., engine proxy not fully ready)
    try {
      const out = await chatCompletionCompat(engine, request);
      if (aborted) throw new DOMException('Aborted', 'AbortError');
      return out;
    } catch (err) {
      const transient = isTransientEngineError(err);
      if (!transient || aborted) throw err;
      await sleep(150);
      const out = await chatCompletionCompat(engine, request);
      if (aborted) throw new DOMException('Aborted', 'AbortError');
      return out;
    }
  })();

  if (signal) {
    const abortPromise = new Promise<string>((_, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', onAbort, { once: true });
    });
    return Promise.race([task, abortPromise]) as Promise<string>;
  }
  return task;
}

function omitOnNewToken<T extends WebLLMCompletionRequest>(req: T): Omit<T, 'onNewToken'> {
  const { onNewToken: _onNewToken, ...rest } = req as unknown as Record<string, unknown>;
  return rest as Omit<T, 'onNewToken'>;
}

async function chatCompletionCompat(engine: WebLLMEngine, req: WebLLMCompletionRequest): Promise<string> {
  // Modern API only: engine.chat.completions.create(...)
  const completions = engine.chat?.completions;
  if (completions && typeof completions.create === 'function') {
    // Exclude fields not supported/cloneable across worker boundary (e.g., signal)
    const { onNewToken: _ot, signal: _sg, ...rest } = (req as unknown as Record<string, unknown>);
    const payload = rest as WebLLMCompletionRequest;
    // Enable streaming when a token callback is provided
    if (req.onNewToken) (payload as any).stream = true;
    // IMPORTANT: keep `this` binding on completions to avoid undefined engine inside method
    const res = await completions.create.call(completions, payload as any);
    // If streaming, res may be an async iterable
    if (res && typeof (res as any)[Symbol.asyncIterator] === 'function') {
      let output = '';
      let index = 0;
      let last: any = null;
      for await (const chunk of res as AsyncIterable<any>) {
        last = chunk;
        const token = extractTokenFromChunk(chunk);
        if (token) {
          output += token;
          try {
            req.onNewToken?.(token, undefined, { token_id: index++ });
          } catch {
            // ignore consumer errors
          }
        }
      }
      // if no incremental tokens were surfaced, try to read final text fields
      if (!output && last) {
        const finalText =
          (typeof last.output_text === 'string' && last.output_text) ||
          (last.choices && last.choices[0]?.message?.content) ||
          last.text ||
          '';
        if (finalText) return String(finalText);
      }
      return output;
    }
    // Non-streaming result
    const obj = res as any;
    if (obj?.output_text && typeof obj.output_text === 'string') return obj.output_text;
    const first = obj?.choices && obj.choices.length > 0 ? obj.choices[0] : undefined;
    const text = first?.message?.content ?? first?.text ?? '';
    if (text) return text;
    throw new Error('Empty completion result');
  }
  throw new Error('WebLLM modern chat API (completions.create) not available');
}

function extractTokenFromChunk(chunk: any): string {
  if (!chunk) return '';
  // Try OpenAI-style streamed deltas
  const token = chunk?.choices?.[0]?.delta?.content ?? chunk?.delta?.content ?? chunk?.text ?? chunk?.token;
  return typeof token === 'string' ? token : '';
}

function isChatApiAvailable(engine: WebLLMEngine | null | undefined): engine is WebLLMEngine {
  if (!engine) return false;
  const modern = typeof engine.chat?.completions?.create === 'function';
  return modern;
}

function isTransientEngineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Cannot read properties of undefined\s*\(reading 'engine'\)/i.test(msg) || /not a function/i.test(msg);
}

export async function waitForChatApi(engine: WebLLMEngine | null | undefined, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!isChatApiAvailable(engine)) {
    if (Date.now() - start > timeoutMs) throw new Error('WebLLM chat API not ready');
    await sleep(50);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureChatApiReady(timeoutMs = 8000, onProgress?: (report: WebLLMProgress) => void): Promise<void> {
  const eng = await (getEnginePromise() ?? loadEngineByManager('smart'));
  try { onProgress?.({ text: '채팅 API 준비 중', progress: 0.94 }); } catch {}
  await waitForChatApi(eng, timeoutMs);
  try { onProgress?.({ text: '채팅 API 준비 완료', progress: 0.96 }); } catch {}
}

// Actively exercise chat API with a minimal request. Does not trigger initialisation
// if engine/model haven't been started (returns false instead).
export async function probeChatApiActive(timeoutMs = 800): Promise<boolean> {
  const pending = getEnginePromise();
  if (!pending) return false;
  try {
    const engine = await pending;
    await waitForChatApi(engine, 8000);
    const req: WebLLMCompletionRequest = {
      messages: [
        { role: 'system', content: 'ok' },
        { role: 'user', content: 'ping' }
      ],
      temperature: 0,
      top_p: 1,
      max_tokens: 1,
      stream: false
    };
    const ok = await withTimeout(
      (async () => {
        try {
          await chatCompletionCompat(engine, req);
          return true;
        } catch {
          return false;
        }
      })(),
      timeoutMs,
      false
    );
    return ok;
  } catch {
    return false;
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const raced = await Promise.race<T | symbol>([
      p,
      new Promise<symbol>((resolve) => {
        timer = setTimeout(() => resolve(Symbol('timeout')), ms);
      })
    ]);
    if (typeof raced === 'symbol') return fallback;
    return raced as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
// Non-intrusive probe that will NOT trigger engine/model initialisation.
export async function probeChatApiReady(timeoutMs = 500): Promise<{ initialised: boolean; chatApiReady: boolean }> {
  const pending = getEnginePromise();
  if (!pending) return { initialised: false, chatApiReady: false };
  const race = await Promise.race<
    | { engine: WebLLMEngine }
    | { timeout: true }
  >([
    pending.then((engine) => ({ engine })),
    sleep(timeoutMs).then(() => ({ timeout: true }))
  ]);
  if ('timeout' in race) return { initialised: true, chatApiReady: false };
  const engine = race.engine;
  return { initialised: true, chatApiReady: isChatApiAvailable(engine) };
}

// Runtime loader via CDN removed — using package + WebWorker engine instead.

// No custom appConfig is provided; rely on WebLLM's prebuilt model registry.

function normaliseEngineError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (/navigator\.gpu/i.test(message) || /requestAdapter/i.test(message)) {
    return new Error('브라우저에서 WebGPU 어댑터를 초기화하지 못했습니다. Chrome/Edge 최신 버전에서 WebGPU 설정을 활성화해 주세요.');
  }
  if (/Failed to fetch/i.test(message) || /NetworkError/i.test(message)) {
    return new Error('모델 가중치를 내려받지 못했습니다. 네트워크 상태를 확인하거나 CDN 접근이 가능한 환경에서 다시 시도해 주세요.');
  }
  return new Error(message);
}

// createRuntimeLoadError removed

// No window.webllm anymore in package mode
