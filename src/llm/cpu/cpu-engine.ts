import type { ChatOptions } from '../webllm-engine';
import { getActiveModelPreset } from '../engine-selection';

type CpuState = {
  worker: Worker | null;
  initialised: boolean;
  progressCb?: (report: { text?: string; progress?: number }) => void;
};

const state: CpuState = { worker: null, initialised: false };

function ensureWorker(): Worker {
  if (state.worker) return state.worker;
  const w = new Worker(new URL('./cpu.worker.ts', import.meta.url), { type: 'module' });
  w.addEventListener('message', (ev) => {
    if (ev.data?.type === 'progress') {
      try { state.progressCb?.({ text: ev.data?.text, progress: ev.data?.progress }); } catch {}
      // infer initialised from final progress label
      if (String(ev.data?.text || '').includes('완료')) state.initialised = true;
    }
  });
  state.worker = w;
  return w;
}

export function resetCpuEngine() {
  try { state.worker?.postMessage({ type: 'unload' }); } catch {}
  try { state.worker?.terminate(); } catch {}
  state.worker = null;
  state.initialised = false;
}

export function isCpuInitialised(): boolean {
  return state.initialised;
}

export async function loadCpuEngineByManager(
  _manager: 'fast' | 'smart',
  onProgress?: (report: { text?: string; progress?: number }) => void
): Promise<void> {
  const w = ensureWorker();
  state.progressCb = onProgress;
  onProgress?.({ text: '엔진 초기화 중 (CPU)', progress: 0.05 });
  const preset = getActiveModelPreset();
  const appConfig = (preset?.appConfig || {}) as Record<string, unknown>;
  w.postMessage({ type: 'init', modelId: preset?.id || 'gemma3-1b', appConfig });
  // Minimal settle delay
  await new Promise((r) => setTimeout(r, 10));
}

export async function ensureCpuReady(_timeoutMs = 2000, onProgress?: (report: { text?: string; progress?: number }) => void) {
  ensureWorker();
  onProgress?.({ text: '채팅 API 준비 중 (CPU)', progress: 0.94 });
}

export async function probeCpuActive(_timeoutMs = 500): Promise<boolean> {
  return Boolean(state.worker);
}

export async function generateCpuChat(
  prompt: string,
  options: ChatOptions
): Promise<string> {
  const w = ensureWorker();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const { systemPrompt, temperature, topP, maxTokens, signal, onToken } = options;

  const listeners = new Set<(e: MessageEvent<any>) => void>();

  const cleanup = () => {
    for (const l of listeners) w.removeEventListener('message', l as any);
    listeners.clear();
  };

  const p = new Promise<string>((resolve, reject) => {
    let out = '';
    const onMsg = (ev: MessageEvent<any>) => {
      const data = ev.data || {};
      if (data.id !== id) return;
      if (data.type === 'token') {
        const tok = String(data.token || '');
        try { onToken?.(tok, 0); } catch {}
        out += tok;
      } else if (data.type === 'done') {
        cleanup();
        resolve(String(data.text || out));
      } else if (data.type === 'error') {
        cleanup();
        reject(new Error(String(data.error || 'cpu error')));
      } else if (data.type === 'aborted') {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      }
    };
    listeners.add(onMsg);
    w.addEventListener('message', onMsg as any);

    try {
      w.postMessage({
        type: 'run',
        id,
        prompt,
        systemPrompt,
        temperature,
        topP,
        maxTokens
      });
    } catch (err) {
      cleanup();
      reject(err);
    }
  });

  if (signal) {
    if (signal.aborted) {
      try { w.postMessage({ type: 'abort', id }); } catch {}
      cleanup();
      throw new DOMException('Aborted', 'AbortError');
    }
    const onAbort = () => {
      try { w.postMessage({ type: 'abort', id }); } catch {}
      cleanup();
    };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const res = await p;
      return res;
    } finally {
      signal.removeEventListener('abort', onAbort as any);
    }
  }
  return p;
}
