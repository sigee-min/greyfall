import type { LlmManagerKind, WebLLMProgress, ChatOptions } from '../llm-engine';

type State = {
  worker: Worker | null;
  initialised: boolean;
  onProgress?: (r: WebLLMProgress) => void;
};

const state: State = { worker: null, initialised: false };

function ensureWorker(): Worker {
  if (state.worker) return state.worker;
  const w = new Worker(new URL('./transformers.worker.ts', import.meta.url), { type: 'module' });
  w.addEventListener('message', (ev) => {
    const d = (ev as MessageEvent<any>).data || {};
    if (d.type === 'progress') {
      try { state.onProgress?.({ text: d.text as string | undefined, progress: d.progress as number | undefined }); } catch {}
    } else if (d.type === 'ready') {
      state.initialised = true;
      try { state.onProgress?.({ text: '심판자가 준비됐어요.', progress: 1 }); } catch {}
    } else if (d.type === 'unloaded') {
      state.initialised = false;
    } else if (d.type === 'purged') {
      try { state.onProgress?.({ text: '캐시 정리가 완료됐어요.', progress: 1 }); } catch {}
    }
  });
  state.worker = w;
  return w;
}

export function resetTransformersEngine() {
  try { state.worker?.postMessage({ type: 'unload' }); } catch {}
  try { state.worker?.terminate(); } catch {}
  state.worker = null;
  state.initialised = false;
}

export function isTransformersInitialised(): boolean { return state.initialised; }

export async function loadTransformersEngineByManager(
  _manager: LlmManagerKind,
  onProgress?: (r: WebLLMProgress) => void
): Promise<void> {
  state.onProgress = onProgress;
  const w = ensureWorker();
  if (state.initialised) {
    try { state.onProgress?.({ text: '심판자가 준비됐어요.', progress: 1 }); } catch {}
    return;
  }
  const appConfig = { hfModelId: 'onnx-community/gemma-3-1b-it-ONNX-GQA', dtype: 'q4' } as const;
  w.postMessage({ type: 'init', appConfig });
}

export async function ensureTransformersReady(
  manager: LlmManagerKind,
  timeoutMs = 30_000,
  onProgress?: (r: WebLLMProgress) => void
) {
  await loadTransformersEngineByManager(manager, onProgress);
  const start = Date.now();
  while (!state.initialised && Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!state.initialised) throw new Error('Transformers generator not ready');
}

export async function probeTransformersActive(): Promise<boolean> {
  return state.initialised;
}

export async function generateTransformersChat(prompt: string, options: ChatOptions): Promise<string> {
  const w = ensureWorker();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const { systemPrompt, temperature, topP, maxTokens, onToken, signal } = options || {} as ChatOptions;

  const listeners = new Set<(e: MessageEvent<any>) => void>();
  const cleanup = () => { for (const l of listeners) w.removeEventListener('message', l as any); listeners.clear(); };

  const p = new Promise<string>((resolve, reject) => {
    let acc = '';
    const onMsg = (ev: MessageEvent<any>) => {
      const d = ev.data || {};
      if (!d || d.id !== id) return;
      if (d.type === 'token') {
        const t = String(d.token || '');
        acc += t; try { onToken?.(t, 0); } catch {}
      } else if (d.type === 'done') {
        cleanup(); resolve(String(d.text || acc));
      } else if (d.type === 'aborted') {
        cleanup(); reject(new DOMException('Aborted', 'AbortError'));
      } else if (d.type === 'error') {
        cleanup(); reject(new Error(String(d.error || 'transformers error')));
      }
    };
    listeners.add(onMsg); w.addEventListener('message', onMsg as any);
    try {
      w.postMessage({ type: 'run', id, prompt, systemPrompt, temperature, topP, maxTokens });
    } catch (e) {
      cleanup(); reject(e as any);
    }
  });

  if (signal) {
    if (signal.aborted) {
      try { w.postMessage({ type: 'abort', id }); } catch {}
      cleanup();
      throw new DOMException('Aborted', 'AbortError');
    }
    const onAbort = () => { try { w.postMessage({ type: 'abort', id }); } catch {}; cleanup(); };
    signal.addEventListener('abort', onAbort, { once: true });
    try { return await p; } finally { signal.removeEventListener('abort', onAbort as any); }
  }
  return p;
}

export async function purgeTransformersInstalledModels(onProgress?: (r: WebLLMProgress) => void, timeoutMs = 10_000): Promise<boolean> {
  state.onProgress = onProgress;
  const w = ensureWorker();
  return await new Promise<boolean>((resolve) => {
    let done = false;
    const listener = (ev: MessageEvent<any>) => {
      if (ev.data?.type === 'purged') { done = true; cleanup(); resolve(true); }
    };
    const cleanup = () => { w.removeEventListener('message', listener as any); };
    w.addEventListener('message', listener as any);
    try { w.postMessage({ type: 'purge' }); } catch { cleanup(); resolve(false); }
    setTimeout(() => { if (!done) { cleanup(); resolve(false); } }, timeoutMs);
  });
}

