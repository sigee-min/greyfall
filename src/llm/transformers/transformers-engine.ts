import type { ChatOptions } from '../webllm-engine';
import { getActiveModelPreset } from '../engine-selection';
import { emitProgress } from '../progress-bus';

type TransformersState = {
  worker: Worker | null;
  initialised: boolean;
  progressCb?: (report: { text?: string; progress?: number }) => void;
};

const state: TransformersState = { worker: null, initialised: false };
let lastProgressAt = 0;
let didLogFirstProgress = false;

function ensureWorker(): Worker {
  if (state.worker) return state.worker;
  const w = new Worker(new URL('./transformers.worker.ts', import.meta.url), { type: 'module' });
  try { console.info('[transformers] worker spawned'); } catch {}
  w.addEventListener('error', (ev: any) => {
    const msg = String(ev?.message || ev?.error || 'Transformers worker error');
    const report = { text: `Transformers 워커 오류: ${msg}` };
    try { console.error(`[transformers] worker error ${msg}`); } catch {}
    try { emitProgress(report); } catch {}
    try { state.progressCb?.(report); } catch {}
    state.initialised = false;
  });
  w.addEventListener('messageerror', (ev: any) => {
    const msg = String(ev?.message || 'Transformers worker message decode error');
    const report = { text: `Transformers 워커 메시지 오류: ${msg}` };
    try { console.error(`[transformers] worker messageerror ${msg}`); } catch {}
    try { emitProgress(report); } catch {}
    try { state.progressCb?.(report); } catch {}
    state.initialised = false;
  });
  w.addEventListener('message', (ev) => {
    if (ev.data?.type === 'progress') {
      lastProgressAt = Date.now();
      try {
        const text = String(ev.data?.text ?? '');
        const pct = ev.data?.progress;
        const pctText = typeof pct === 'number' ? ` progress=${(pct * 100).toFixed(1)}%` : '';
        if (!didLogFirstProgress) {
          console.info(`[transformers] worker first progress text="${text}"${pctText}`);
          didLogFirstProgress = true;
        } else {
          console.debug(`[transformers] worker progress text="${text}"${pctText}`);
        }
      } catch {}
      const progressReport = { text: ev.data?.text as string | undefined, progress: ev.data?.progress as number | undefined };
      try { emitProgress(progressReport); } catch {}
      try { state.progressCb?.(progressReport); } catch {}
      if (String(ev.data?.text || '').includes('완료')) state.initialised = true;
    } else if (ev.data?.type === 'error' && (ev as any)?.data?.id == null) {
      const msg = String((ev as any)?.data?.error || 'Transformers worker error');
      const report = { text: `Transformers 워커 오류: ${msg}` };
      try {
        const errText = String((ev as any)?.data?.error ?? 'unknown');
        console.error(`[transformers] worker surfaced error ${errText}`);
      } catch {}
      try { emitProgress(report); } catch {}
      try { state.progressCb?.(report); } catch {}
      state.initialised = false;
    }
  });
  setTimeout(() => {
    if (!state.initialised && Date.now() - lastProgressAt > 7000) {
      const report = { text: '준비가 조금 오래 걸려요. 네트워크나 다운로드 상태를 확인해 주세요.', progress: 0.07 };
      try { emitProgress(report); } catch {}
      try { state.progressCb?.(report); } catch {}
    }
  }, 7000);
  state.worker = w;
  return w;
}

export function resetTransformersEngine(reason: string = 'transformers:reset') {
  try { state.worker?.postMessage({ type: 'unload' }); } catch {}
  try { state.worker?.terminate(); } catch {}
  state.worker = null;
  state.initialised = false;
  const report = { text: '심판자 엔진을 다시 불러올 준비를 하고 있어요.', progress: 0.02 };
  try { emitProgress(report); } catch {}
  try { state.progressCb?.(report); } catch {}
  try { console.warn(`[transformers] engine reset (${reason})`); } catch {}
}

export function isTransformersInitialised(): boolean {
  return state.initialised;
}

export async function loadTransformersEngineByManager(
  manager: 'fast' | 'smart',
  onProgress?: (report: { text?: string; progress?: number }) => void
): Promise<void> {
  const w = ensureWorker();
  state.progressCb = onProgress;
  if (state.initialised) {
    const readyReport = { text: '심판자가 준비됐어요.', progress: 1.0 };
    try { emitProgress(readyReport); } catch {}
    onProgress?.(readyReport);
    return;
  }
  const startReport = { text: '심판자를 준비하고 있어요…', progress: 0.05 };
  try { emitProgress(startReport); } catch {}
  onProgress?.(startReport);
  const preset = getActiveModelPreset();
  if (!(preset && preset.backend === 'cpu' && preset.packaging === 'onnx' && typeof (preset.appConfig as any)?.hfModelId === 'string')) {
    throw new Error('Invalid or missing transformers model preset (hfModelId required)');
  }
  const appConfig = (preset!.appConfig || {}) as Record<string, unknown>;
  try {
    const meta = { hfModelId: (appConfig as any)?.hfModelId, dtype: (appConfig as any)?.dtype, device: (appConfig as any)?.device };
    console.info(`[transformers] init post preset=${preset?.id ?? 'unknown'} manager=${manager} hfModelId=${String(meta.hfModelId ?? 'n/a')} dtype=${String(meta.dtype ?? 'n/a')} device=${String(meta.device ?? 'n/a')}`);
  } catch {}
  w.postMessage({ type: 'init', modelId: preset?.id, appConfig });
  await new Promise((r) => setTimeout(r, 10));
}

export async function ensureTransformersReady(
  manager: 'fast' | 'smart',
  timeoutMs = 8000,
  onProgress?: (report: { text?: string; progress?: number }) => void,
  maxAttempts = 2
) {
  ensureWorker();
  state.progressCb = onProgress;
  if (state.initialised) {
    const readyReport = { text: '심판자가 준비됐어요.', progress: 1.0 };
    try { emitProgress(readyReport); } catch {}
    onProgress?.(readyReport);
    return;
  }

  let attempt = 0;
  while (attempt < Math.max(1, maxAttempts)) {
    if (!state.initialised) {
      await loadTransformersEngineByManager(manager, onProgress);
    }

    const start = Date.now();
    const hint = { text: '대화를 위한 준비를 마무리하는 중이에요…', progress: 0.94 };
    try { emitProgress(hint); } catch {}
    onProgress?.(hint);

    while (!state.initialised && Date.now() - start <= Math.max(500, timeoutMs)) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 150));
    }

    if (state.initialised) {
      const done = { text: '심판자가 준비됐어요.', progress: 1.0 };
      try { emitProgress(done); } catch {}
      onProgress?.(done);
      return;
    }

    attempt += 1;
    if (attempt >= maxAttempts) break;
    resetTransformersEngine('transformers:retry');
    await new Promise((r) => setTimeout(r, 300));
  }

  const msg = 'Transformers generator not ready';
  try { emitProgress({ text: '로컬 LLM을 준비하지 못했어요.', progress: 0.22 }); } catch {}
  throw new Error(msg);
}

export async function probeTransformersActive(_timeoutMs = 500): Promise<boolean> {
  return Boolean(state.worker);
}

export async function generateTransformersChat(
  prompt: string,
  options: ChatOptions
): Promise<string> {
  const w = ensureWorker();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const { systemPrompt, temperature, topP, maxTokens, signal, onToken } = options;
  try { console.info(`[transformers] run start id=${id} maxTokens=${maxTokens ?? 'n/a'}`); } catch {}

  const listeners = new Set<(e: MessageEvent<any>) => void>();

  const cleanup = () => {
    for (const l of listeners) w.removeEventListener('message', l as any);
    listeners.clear();
  };

  const p = new Promise<string>((resolve, reject) => {
    let out = '';
    const onProgressMsg = (ev: MessageEvent<any>) => {
      if (ev.data?.type === 'progress') {
        const report = { text: ev.data?.text as string | undefined, progress: ev.data?.progress as number | undefined };
        try { emitProgress(report); } catch {}
        try { state.progressCb?.(report); } catch {}
      }
    };
    listeners.add(onProgressMsg);
    w.addEventListener('message', onProgressMsg as any);
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
        try { console.error(`[transformers] run error id=${id} message=${String(data.error ?? 'unknown')}`); } catch {}
        cleanup();
        reject(new Error(String(data.error || 'transformers error')));
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
