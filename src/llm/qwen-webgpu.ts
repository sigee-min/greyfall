import { CreateWebWorkerMLCEngine } from '@mlc-ai/web-llm';

export type LlmManagerKind = 'hasty' | 'fast' | 'smart';
type ModelProfile = { id: string };
// Qwen3 profiles (use prebuilt registry inside WebLLM)
const QWEN3_HASTY: ModelProfile = { id: 'Qwen3-0.6B-q4f16_1-MLC' };
const QWEN3_FAST: ModelProfile = { id: 'Qwen3-1.7B-q4f32_1-MLC' };
const QWEN3_SMART: ModelProfile = { id: 'Qwen3-4B-q0f16-MLC' };
function resolveProfiles(kind: LlmManagerKind): ModelProfile[] {
  if (kind === 'hasty') return [QWEN3_HASTY];
  if (kind === 'fast') return [QWEN3_FAST];
  return [QWEN3_SMART];
}

export type QwenChatOptions = {
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (token: string, tokenIndex: number) => void;
};

type WebLLMProgress = { text?: string; progress?: number };

type WebLLMChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type WebLLMCompletionRequest = {
  messages: WebLLMChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
  onNewToken?: (token: string, progress?: WebLLMProgress, metadata?: { token_id: number }) => void;
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

let enginePromise: Promise<WebLLMEngine> | null = null;

export async function loadQwenEngineByManager(
  manager: LlmManagerKind,
  onProgress?: (report: WebLLMProgress) => void
): Promise<WebLLMEngine> {
  if (typeof window === 'undefined') {
    throw new Error('Qwen WebGPU runtime is only available in the browser environment.');
  }

  if (!window.isSecureContext) {
    throw new Error('WebGPU는 보안(HTTPS) 환경에서만 동작합니다. HTTPS 페이지로 접속해 주세요.');
  }

  const nav = navigator as Navigator & { gpu?: unknown };
  if (!('gpu' in nav) || !nav.gpu) {
    throw new Error('이 브라우저는 WebGPU를 지원하지 않습니다. Chrome 113+ (chrome://flags/#enable-unsafe-webgpu) 또는 최신 Edge에서 시도해 주세요.');
  }

  if (!enginePromise) {
    const attempts = resolveProfiles(manager);
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
        const debug = Boolean((import.meta as any).env?.VITE_LLM_DEBUG);
        const wrappedProgress = (report: WebLLMProgress) => {
          try {
            onProgress?.(report);
            if (debug && (report.text || typeof report.progress === 'number')) {
              console.debug('[webllm] progress', report);
            }
          } catch {}
        };
        // Ensure "initialised" 로그는 실제 resolve 시점에만 출력
        enginePromise = (async () => {
          const eng = (await (CreateWebWorkerMLCEngine(
            worker as unknown as Worker,
            profile.id,
            { initProgressCallback: wrappedProgress }
          ) as any)) as WebLLMEngine;
          console.info('[webllm] model initialised', { id: profile.id });
          return eng;
        })();
        break;
      } catch (error) {
        console.warn('[webllm] model init failed', { id: profile.id, error });
        enginePromise = null;
        lastError = error;
      }
    }
    if (!enginePromise) throw normaliseEngineError(lastError);
  }

  return enginePromise;
}

// Allow UI to force a fresh initialisation attempt if previous one got stuck
export function resetQwenEngine() { enginePromise = null; }

export async function generateQwenChat(prompt: string, options: QwenChatOptions = {}) {
  const {
    systemPrompt = 'You are a seasoned guide who offers concise, practical suggestions.',
    temperature = 0.7,
    topP = 0.9,
    maxTokens = 512,
    signal,
    onToken
  } = options;

  // Assume engine has already been initialised by manager selection path
  let engine = await (enginePromise ?? loadQwenEngineByManager('smart'));

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
    stream: Boolean(onToken),
    signal,
    onNewToken: onToken
      ? (token: string, progress?: WebLLMProgress, metadata?: { token_id: number }) => {
          void progress;
          onToken(token, metadata?.token_id ?? 0);
        }
      : undefined
  };

  // One-time recovery on transient TypeError (e.g., engine proxy not fully ready)
  let text: string;
  try {
    text = await chatCompletionCompat(engine, request);
  } catch (err) {
    const transient = isTransientEngineError(err);
    if (!transient) throw err;
    await sleep(150);
    text = await chatCompletionCompat(engine, request);
  }
  return text;
}

function omitOnNewToken<T extends WebLLMCompletionRequest>(req: T): Omit<T, 'onNewToken'> {
  const { onNewToken: _onNewToken, ...rest } = req as unknown as Record<string, unknown>;
  return rest as Omit<T, 'onNewToken'>;
}

async function chatCompletionCompat(engine: WebLLMEngine, req: WebLLMCompletionRequest): Promise<string> {
  // Modern API only: engine.chat.completions.create(...)
  const create = engine.chat?.completions?.create;
  if (typeof create === 'function') {
    const payload = omitOnNewToken(req) as WebLLMCompletionRequest;
    // Enable streaming when a token callback is provided
    if (req.onNewToken) (payload as any).stream = true;
    const res = await create(payload);
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

export async function ensureChatApiReady(timeoutMs = 8000): Promise<void> {
  const eng = await (enginePromise ?? loadQwenEngineByManager('smart'));
  await waitForChatApi(eng, timeoutMs);
}

// Actively exercise chat API with a minimal request. Does not trigger initialisation
// if engine/model haven't been started (returns false instead).
export async function probeChatApiActive(timeoutMs = 800): Promise<boolean> {
  const pending = enginePromise;
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
  const pending = enginePromise;
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
