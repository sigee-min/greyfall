import type { LlmManagerKind, WebLLMProgress, ChatOptions } from '../llm-engine';
import { emitProgress } from '../progress-bus';
import { openStream, pushToken, markDone, markError, markAborted } from '../stream-bus';

type State = {
  worker: Worker | null;
  initialised: boolean;
  initPromise: Promise<void> | null;
  initResolve?: () => void;
  initReject?: (err: any) => void;
};

const state: State = { worker: null, initialised: false, initPromise: null };

function ensureWorker(): Worker {
  if (state.worker) return state.worker;
  const w = new Worker(new URL('./transformers.worker.ts', import.meta.url), { type: 'module' });
  w.addEventListener('message', (ev) => {
    const d = (ev as MessageEvent<any>).data || {};
    if (d.type === 'progress') {
      const text = String(d.text ?? '');
      // Set initialised when official callback reports 'ready'
      if (text === 'ready') {
        state.initialised = true;
        if (state.initResolve) { try { state.initResolve(); } catch {} }
        state.initPromise = null; state.initResolve = undefined; state.initReject = undefined;
      }
      emitProgress({ text, progress: d.progress as number | undefined });
    } else if (d.type === 'ready') {
      // Reserved: worker no longer sends explicit 'ready'; rely on progress 'ready'
    } else if (d.type === 'unloaded') {
      state.initialised = false;
      if (state.initReject) { try { state.initReject(new Error('worker unloaded')); } catch {} }
      state.initPromise = null; state.initResolve = undefined; state.initReject = undefined;
    } else if (d.type === 'error' && !d.id) {
      // init-level error (no id)
      state.initialised = false;
      if (state.initReject) { try { state.initReject(new Error(String(d.error || 'transformers init error'))); } catch {} }
      state.initPromise = null; state.initResolve = undefined; state.initReject = undefined;
    } else if (d.type === 'purged') {
      // Optional: caller may choose to show a toast; keep progress quiet here
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
  state.initPromise = null; state.initResolve = undefined; state.initReject = undefined;
}

export function isTransformersInitialised(): boolean { return state.initialised; }

export async function loadTransformersEngineByManager(
  _manager: LlmManagerKind,
  _onProgress?: (r: WebLLMProgress) => void
): Promise<void> {
  const w = ensureWorker();
  if (state.initialised) {
    emitProgress({ text: 'ready', progress: 1 });
    return;
  }
  if (state.initPromise) { await state.initPromise; return; }
  state.initPromise = new Promise<void>((resolve, reject) => { state.initResolve = resolve; state.initReject = reject; });
  try {
    const appConfig = { hfModelId: 'onnx-community/gemma-3-1b-it-ONNX-GQA', dtype: 'q8' } as const;
    w.postMessage({ type: 'init', appConfig });
  } catch (e) {
    const rej = state.initReject; state.initPromise = null; state.initResolve = undefined; state.initReject = undefined;
    if (rej) rej(e);
    throw e;
  }
  await state.initPromise;
}

export async function ensureTransformersReady(
  manager: LlmManagerKind,
  timeoutMs = 30_000,
  _onProgress?: (r: WebLLMProgress) => void
) {
  await loadTransformersEngineByManager(manager);
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

  // Open monitoring stream (tee) irrespective of consumer's onToken usage
  const streamId = openStream({
    id,
    promptPreview: String(prompt || '').slice(0, 200),
    systemPreview: typeof systemPrompt === 'string' ? String(systemPrompt).slice(0, 200) : undefined,
    prompt: String(prompt || ''),
    system: typeof systemPrompt === 'string' ? String(systemPrompt) : undefined,
    options: { temperature, topP, maxTokens }
  });

  const listeners = new Set<(e: MessageEvent<any>) => void>();
  const cleanup = () => { for (const l of listeners) w.removeEventListener('message', l as any); listeners.clear(); };

  const p = new Promise<string>((resolve, reject) => {
    let acc = '';
    const onMsg = (ev: MessageEvent<any>) => {
      const d = ev.data || {};
      if (!d || d.id !== id) return;
      if (d.type === 'token') {
        const t = String(d.token || '');
        acc += t;
        try { onToken?.(t, 0); } catch {}
        try { pushToken(streamId, t); } catch {}
      } else if (d.type === 'done') {
        cleanup();
        const text = String(d.text || acc);
        try { markDone(streamId, text); } catch {}
        resolve(text);
      } else if (d.type === 'aborted') {
        cleanup();
        try { markAborted(streamId); } catch {}
        reject(new DOMException('Aborted', 'AbortError'));
      } else if (d.type === 'error') {
        cleanup();
        const errMsg = String(d.error || 'transformers error');
        try { markError(streamId, errMsg); } catch {}
        reject(new Error(errMsg));
      }
    };
    listeners.add(onMsg); w.addEventListener('message', onMsg as any);
    try {
      w.postMessage({ type: 'run', id, prompt, systemPrompt, temperature, topP, maxTokens });
    } catch (e) {
      cleanup();
      try { markError(streamId, String((e as any)?.message || e)); } catch {}
      reject(e as any);
    }
  });

  if (signal) {
    if (signal.aborted) {
      try { w.postMessage({ type: 'abort', id }); } catch {}
      cleanup();
      try { markAborted(streamId); } catch {}
      throw new DOMException('Aborted', 'AbortError');
    }
    const onAbort = () => { try { w.postMessage({ type: 'abort', id }); } catch {}; cleanup(); };
    signal.addEventListener('abort', onAbort, { once: true });
    try { return await p; } finally { signal.removeEventListener('abort', onAbort as any); }
  }
  return p;
}

export async function purgeTransformersInstalledModels(onProgress?: (r: WebLLMProgress) => void, timeoutMs = 10_000): Promise<boolean> {
  const w = ensureWorker();
  return await new Promise<boolean>((resolve) => {
    let done = false;
    const listener = (ev: MessageEvent<any>) => {
      const d = ev.data || {};
      if (d.type === 'progress') {
        try { onProgress?.({ text: d.text as string | undefined, progress: d.progress as number | undefined }); } catch {}
      } else if (d.type === 'purged') { done = true; cleanup(); resolve(true); }
    };
    const cleanup = () => { w.removeEventListener('message', listener as any); };
    w.addEventListener('message', listener as any);
    try { w.postMessage({ type: 'purge' }); } catch { cleanup(); resolve(false); }
    setTimeout(() => { if (!done) { cleanup(); resolve(false); } }, timeoutMs);
  });
}
