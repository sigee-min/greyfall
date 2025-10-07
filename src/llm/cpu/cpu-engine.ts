import type { ChatOptions } from '../webllm-engine';
import { getActiveModelPreset } from '../engine-selection';
import { emitProgress } from '../progress-bus';

type CpuState = {
  worker: Worker | null;
  initialised: boolean;
  progressCb?: (report: { text?: string; progress?: number }) => void;
};

const state: CpuState = { worker: null, initialised: false };
let lastProgressAt = 0;
let didLogFirstProgress = false;

function ensureWorker(): Worker {
  if (state.worker) return state.worker;
  const w = new Worker(new URL('./cpu.worker.ts', import.meta.url), { type: 'module' });
  try { console.info('[cpu] worker spawned'); } catch {}
  // Surface worker-level failures to UI so we don't look stuck on "로딩 중…"
  w.addEventListener('error', (ev: any) => {
    const msg = String(ev?.message || ev?.error || 'CPU 워커 오류');
    const report = { text: `CPU 워커 오류: ${msg}` };
    try { console.error('[cpu] worker error', ev); } catch {}
    try { emitProgress(report); } catch {}
    try { state.progressCb?.(report); } catch {}
    state.initialised = false;
  });
  w.addEventListener('messageerror', (ev: any) => {
    const msg = String(ev?.message || 'CPU 워커 메시지 디코딩 오류');
    const report = { text: `CPU 워커 메시지 오류: ${msg}` };
    try { console.error('[cpu] worker messageerror', ev); } catch {}
    try { emitProgress(report); } catch {}
    try { state.progressCb?.(report); } catch {}
    state.initialised = false;
  });
  w.addEventListener('message', (ev) => {
    if (ev.data?.type === 'progress') {
      lastProgressAt = Date.now();
      try {
        if (!didLogFirstProgress) {
          console.info('[cpu] worker first progress', ev.data);
          didLogFirstProgress = true;
        } else {
          console.debug('[cpu] worker progress', ev.data);
        }
      } catch {}
      const progressReport = { text: ev.data?.text as string | undefined, progress: ev.data?.progress as number | undefined };
      try { emitProgress(progressReport); } catch {}
      try { state.progressCb?.(progressReport); } catch {}
      // infer initialised from final progress label
      if (String(ev.data?.text || '').includes('완료')) state.initialised = true;
    } else if (ev.data?.type === 'error' && (ev as any)?.data?.id == null) {
      // Non-run error surfaced from worker
      const msg = String((ev as any)?.data?.error || 'CPU 워커 오류');
      const report = { text: `CPU 워커 오류: ${msg}` };
      try { console.error('[cpu] worker surfaced error', ev.data); } catch {}
      try { emitProgress(report); } catch {}
      try { state.progressCb?.(report); } catch {}
      state.initialised = false;
    }
  });
  // Simple startup watchdog: if no progress within 7s after worker creation, hint user
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
  manager: 'fast' | 'smart',
  onProgress?: (report: { text?: string; progress?: number }) => void
): Promise<void> {
  const w = ensureWorker();
  state.progressCb = onProgress;
  const startReport = { text: '심판자를 준비하고 있어요…', progress: 0.05 };
  try { emitProgress(startReport); } catch {}
  onProgress?.(startReport);
  const preset = getActiveModelPreset();
  if (!(preset && preset.backend === 'cpu' && preset.packaging === 'onnx' && typeof (preset.appConfig as any)?.hfModelId === 'string')) {
    throw new Error('Invalid or missing CPU/ONNX model preset (hfModelId required)');
  }
  // Use preset-provided appConfig as-is (simple, predictable)
  const appConfig = (preset!.appConfig || {}) as Record<string, unknown>;
  try {
    const meta = { hfModelId: (appConfig as any)?.hfModelId, dtype: (appConfig as any)?.dtype, device: (appConfig as any)?.device };
    console.info('[cpu] init post', { modelPreset: preset?.id, manager, ...meta });
  } catch {}
  w.postMessage({ type: 'init', modelId: preset?.id, appConfig });
  // Minimal settle delay
  await new Promise((r) => setTimeout(r, 10));
}

export async function ensureCpuReady(timeoutMs = 8000, onProgress?: (report: { text?: string; progress?: number }) => void) {
  ensureWorker();
  const start = Date.now();
  // 표준화된 진행 안내(단조 증가 보장 X — 버스에서 처리)
  const hint = { text: '대화를 위한 준비를 마무리하는 중이에요…', progress: 0.94 };
  try { emitProgress(hint); } catch {}
  onProgress?.(hint);
  // 파이프라인 준비 완료(state.initialised)까지 대기
  while (!state.initialised) {
    if (Date.now() - start > Math.max(500, timeoutMs)) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 150));
  }
  // If not initialised after timeout, surface a clear error for UI instead of pretending ready
  if (!state.initialised) {
    const msg = 'CPU generator not ready';
    try { emitProgress({ text: '로컬 LLM을 준비하지 못했어요.', progress: 0.22 }); } catch {}
    throw new Error(msg);
  }
  // 요청대로 1초 대기 후 100%로 마무리
  // eslint-disable-next-line no-promise-executor-return
  await new Promise((r) => setTimeout(r, 1000));
  const done = { text: '심판자가 준비됐어요.', progress: 1.0 };
  try { emitProgress(done); } catch {}
  onProgress?.(done);
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
  try { console.info('[cpu] run start', { id, maxTokens }); } catch {}

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
        try { console.error('[cpu] run error', data); } catch {}
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
