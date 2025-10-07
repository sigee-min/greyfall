// Transformers.js Worker: init → ready, run → stream tokens, abort/unload/purge support

// Suppress noisy hub warnings about missing Content-Length
// Example: "Unable to determine content-length from response headers. Will expand buffer when needed."
(() => {
  const FILTERS = [
    'Unable to determine content-length',
    'Will expand buffer when needed.'
  ];
  const shouldDrop = (args: any[]) => {
    try {
      const msg = String(args?.[0] ?? '');
      return FILTERS.some((s) => msg.includes(s));
    } catch { return false; }
  };
  const wrap = <T extends (...a: any[]) => any>(fn: T): T => {
    return ((...a: any[]) => { if (!shouldDrop(a)) return (fn as any)(...a); }) as any as T;
  };
  // Narrowly wrap warn/info/log used by transformers.js hub client
  try {
    // eslint-disable-next-line no-console
    console.warn = wrap(console.warn.bind(console));
    // eslint-disable-next-line no-console
    console.info = wrap(console.info.bind(console));
    // eslint-disable-next-line no-console
    console.log = wrap(console.log.bind(console));
  } catch {}
})();

type InitMsg = { type: 'init'; appConfig?: Record<string, unknown> };
type RunMsg = {
  type: 'run';
  id: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
};
type AbortMsg = { type: 'abort'; id: string };
type UnloadMsg = { type: 'unload' };
type PurgeMsg = { type: 'purge' };
type InMessage = InitMsg | RunMsg | AbortMsg | UnloadMsg | PurgeMsg;

let initialised = false;
let hfGenerator: any | null = null;
const aborted = new Set<string>();

import { pipeline, TextStreamer } from '@huggingface/transformers';

function emitProgress(text: string, progress?: number) {
  (self as any).postMessage({ type: 'progress', text, progress });
}

function pick<T>(v: T | undefined, d: T): T { return (v === undefined || v === null ? d : v); }

self.onmessage = async (evt: MessageEvent<InMessage>) => {
  const msg = evt.data as InMessage;
  switch (msg.type) {
    case 'init': {
      // Use Transformers.js progress_callback statuses as-is; avoid extra wording here.
      const cfg = (msg.appConfig || {}) as any;
      const hfModelId = String(cfg?.hfModelId || 'onnx-community/gemma-3-1b-it-ONNX-GQA');
      const dtype = String(pick(cfg?.dtype, 'q4'));
      try {
        // Environment probe: COOP/COEP (cross-origin isolation) and SharedArrayBuffer availability
        try {
          const origin = (self as any).location?.origin ?? '(unknown)';
          const isolated = (self as any).crossOriginIsolated === true;
          const sabAvail = typeof (self as any).SharedArrayBuffer !== 'undefined';
          let sabAlloc = false;
          try { if (sabAvail) { const b = new (self as any).SharedArrayBuffer(16); sabAlloc = b.byteLength === 16; } } catch {}
          // eslint-disable-next-line no-console
          console.info('[llm-worker] env', { origin, crossOriginIsolated: isolated, sharedArrayBuffer: sabAvail, sabAlloc });
          try {
            const href = (self as any).location?.href || '/';
            const res = await fetch(href, { method: 'GET', cache: 'no-store' });
            const coop = res.headers.get('cross-origin-opener-policy');
            const coep = res.headers.get('cross-origin-embedder-policy');
            const corp = res.headers.get('cross-origin-resource-policy');
            // eslint-disable-next-line no-console
            console.info('[llm-worker] headers', { coop, coep, corp });
          } catch {}
        } catch {}
        // First attempt with progress callback that forwards raw status strings
        const withProgress = { device: 'wasm', dtype, progress_callback: (data: any) => {
          const status = String(data?.status ?? '');
          const file = data?.file ? String(data.file) : '';
          const loaded = typeof data?.loaded === 'number' ? data.loaded : undefined;
          const total = typeof data?.total === 'number' ? data.total : undefined;
          const pctRaw = typeof data?.progress === 'number' ? Math.max(0, Math.min(100, data.progress)) : undefined;
          const pct = typeof pctRaw === 'number' ? Math.round(pctRaw) : undefined;

          const fmtBytes = (n?: number) => {
            if (typeof n !== 'number' || !isFinite(n)) return undefined;
            const units = ['B','KB','MB','GB'];
            let v = n, i = 0;
            while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
            return `${v.toFixed(v >= 10 ? 0 : 1)}${units[i]}`;
          };

          let text = status;
          switch (status) {
            case 'initiate':
              text = file ? `설치 준비: ${file}` : '설치 준비';
              break;
            case 'download':
              text = file ? `다운로드 시작: ${file}` : '다운로드 시작';
              break;
            case 'progress': {
              const lp = fmtBytes(loaded);
              const tp = fmtBytes(total);
              if (file) {
                if (lp && tp && typeof pct === 'number') text = `다운로드 진행: ${file} ${lp}/${tp} (${pct}%)`;
                else if (lp && tp) text = `다운로드 진행: ${file} ${lp}/${tp}`;
                else if (lp && typeof pct === 'number') text = `다운로드 진행: ${file} ${lp} (${pct}%)`;
                else if (typeof pct === 'number') text = `다운로드 진행: ${file} ${pct}%`;
                else text = `다운로드 진행: ${file}`;
              } else {
                if (lp && tp && typeof pct === 'number') text = `다운로드 진행: ${lp}/${tp} (${pct}%)`;
                else if (lp && tp) text = `다운로드 진행: ${lp}/${tp}`;
                else if (lp && typeof pct === 'number') text = `다운로드 진행: ${lp} (${pct}%)`;
                else if (typeof pct === 'number') text = `다운로드 진행: ${pct}%`;
                else text = '다운로드 진행';
              }
              break;
            }
            case 'done':
              text = file ? `다운로드 완료: ${file}` : '다운로드 완료';
              break;
            default:
              break;
          }
          (self as any).postMessage({ type: 'progress', text, progress: typeof pct === 'number' ? (pct / 100) : undefined });
        }} as any;
        try {
          hfGenerator = await pipeline('text-generation', hfModelId, withProgress);
        } catch (e) {
          // Simple dtype fallback q8 -> q4
          if (dtype === 'q8') {
            try {
              hfGenerator = await pipeline('text-generation', hfModelId, { ...withProgress, dtype: 'q4' } as any);
            } catch {}
          }
          if (!hfGenerator) throw e;
        }
        initialised = true;
        try { (self as any).postMessage({ type: 'progress', text: 'ready', progress: 1 }); } catch {}
      } catch (e: any) {
        initialised = false;
        const msg = String(e?.message || e);
        (self as any).postMessage({ type: 'progress', text: msg, progress: 0.21 });
        (self as any).postMessage({ type: 'error', error: msg });
      }
      break;
    }
    case 'run': {
      if (!initialised || !hfGenerator) {
        (self as any).postMessage({ type: 'error', id: msg.id, error: 'Transformers engine not initialised' });
        return;
      }
      let streamed = '';
      const streamer = new TextStreamer((hfGenerator as any).tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text: string) => {
          if (aborted.has(msg.id)) return;
          streamed += text;
          (self as any).postMessage({ type: 'token', id: msg.id, token: text });
        }
      } as any);
      try {
        const messages = [
          { role: 'system', content: String(msg.systemPrompt || 'You are a helpful assistant.') },
          { role: 'user', content: String(msg.prompt || '') }
        ];
        const do_sample = typeof msg.temperature === 'number' ? msg.temperature > 0 : false;
        const opts = {
          max_new_tokens: typeof msg.maxTokens === 'number' && msg.maxTokens > 0 ? msg.maxTokens : 128,
          do_sample,
          top_p: typeof msg.topP === 'number' ? msg.topP : 0.9,
          streamer
        } as any;
        const out = await hfGenerator(messages as any, opts);
        if (!aborted.has(msg.id)) {
          const text = String((out?.[0]?.generated_text?.at?.(-1)?.content) ?? streamed ?? '');
          (self as any).postMessage({ type: 'done', id: msg.id, text });
        } else {
          (self as any).postMessage({ type: 'aborted', id: msg.id });
        }
      } catch (e: any) {
        const err = String(e?.message || e);
        (self as any).postMessage({ type: 'error', id: msg.id, error: err });
      } finally {
        aborted.delete((msg as RunMsg).id);
      }
      break;
    }
    case 'abort': {
      aborted.add(msg.id);
      break;
    }
    case 'unload': {
      try { await (hfGenerator?.dispose?.()); } catch {}
      hfGenerator = null;
      initialised = false;
      (self as any).postMessage({ type: 'unloaded' });
      break;
    }
    case 'purge': {
      try {
        emitProgress('캐시를 정리하고 있어요…', 0.22);
        if ('caches' in self) {
          const keys = await caches.keys();
          for (const k of keys) { try { await caches.delete(k); } catch {} }
          try { await caches.delete('transformers-cache'); } catch {}
        }
        try {
          const anySelf: any = self as any;
          if (anySelf.indexedDB && anySelf.indexedDB.databases) {
            const dbs = await anySelf.indexedDB.databases();
            if (Array.isArray(dbs)) {
              for (const db of dbs) {
                const name = (db as any)?.name;
                if (name) {
                  try { await new Promise((res) => { const req = anySelf.indexedDB.deleteDatabase(name); req.onsuccess = () => res(null); req.onerror = () => res(null); req.onblocked = () => res(null); }); } catch {}
                }
              }
            }
          }
        } catch {}
        (self as any).postMessage({ type: 'purged' });
      } catch { (self as any).postMessage({ type: 'purged' }); }
      break;
    }
    default:
      break;
  }
};
