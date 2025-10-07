// Transformers.js Worker: init → ready, run → stream tokens, abort/unload/purge support

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
      emitProgress('모델을 준비하고 있어요…', 0.1);
      const cfg = (msg.appConfig || {}) as any;
      const hfModelId = String(cfg?.hfModelId || 'onnx-community/gemma-3-1b-it-ONNX-GQA');
      const dtype = String(pick(cfg?.dtype, 'q4'));
      try {
        emitProgress('필요한 파일을 불러오는 중이에요…', 0.25);
        // First attempt
        try {
          hfGenerator = await pipeline('text-generation', hfModelId, { dtype } as any);
        } catch (e) {
          // Simple dtype fallback q4 -> q8
          if (dtype === 'q4') {
            try { hfGenerator = await pipeline('text-generation', hfModelId, { dtype: 'q8' } as any); } catch {}
          }
          if (!hfGenerator) throw e;
        }
        emitProgress('거의 준비됐어요…', 0.9);
        initialised = true;
        (self as any).postMessage({ type: 'ready' });
      } catch (e: any) {
        initialised = false;
        const msg = String(e?.message || e);
        emitProgress(`모델을 가져오지 못했어요: ${msg}`, 0.21);
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

