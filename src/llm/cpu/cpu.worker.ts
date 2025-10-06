// CPU WASM worker skeleton. Replace internals with ONNX/llama.cpp later.

type InitMsg = { type: 'init'; modelId: string; threads?: number; simd?: boolean; appConfig?: Record<string, unknown> };
type RunMsg = {
  type: 'run';
  id: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
};
type AbortMsg = { type: 'abort'; id?: string };
type UnloadMsg = { type: 'unload' };
type InMessage = InitMsg | RunMsg | AbortMsg | UnloadMsg;

let initialised = false;
let inflight: { id: string; ctl: AbortController } | null = null;
let backend: 'stub' | 'onnx' | 'hf' = 'stub';
let hfGenerator: any | null = null;

// ORT integration (loaded lazily if configured)
import { ensureOrt, loadOrtSession, getOrtSession } from './backends/ort';
import { pipeline } from '@huggingface/transformers';

function emitProgress(text: string, progress?: number) {
  (self as any).postMessage({ type: 'progress', text, progress });
}

self.onmessage = async (evt: MessageEvent<InMessage>) => {
  const msg = evt.data;
  switch (msg.type) {
    case 'init': {
      emitProgress('엔진 초기화 중 (CPU)', 0.1);
      const cfg = (msg.appConfig || {}) as any;
      // Preferred: Transformers.js pipeline (downloads from HF Hub by default)
      try {
        const hfModelId = String(cfg?.hfModelId || 'onnx-community/gemma-3-1b-it-ONNX-GQA');
        const dtype = (cfg?.dtype as string) || 'q4';
        emitProgress('파이프라인 준비 (HF Transformers)', 0.25);
        hfGenerator = await pipeline('text-generation', hfModelId, { dtype } as any);
        backend = 'hf';
        emitProgress('모델 파이프라인 준비 완료', 0.9);
      } catch (_e) {
        // Fallback: direct ORT session if configured
        const ortPrep = await ensureOrt({ ortScriptUrl: String(cfg?.ortScriptUrl || '') || undefined });
        if (ortPrep.ok && cfg?.modelUrl) {
          emitProgress('런타임 로드 (ORT)', 0.3);
          const sess = await loadOrtSession({ modelUrl: String(cfg.modelUrl) });
          if (sess.ok && getOrtSession()) {
            backend = 'onnx';
            emitProgress('모델 세션 준비 완료 (ORT)', 0.9);
          } else {
            backend = 'stub';
            emitProgress('세션 로드 실패 — 대체 경로 사용', 0.4);
          }
        } else {
          backend = 'stub';
          emitProgress('대체 경로 사용 (HF/ORT 미설정)', 0.2);
        }
      }
      initialised = true;
      emitProgress('엔진 초기화 완료 (CPU)', 0.95);
      break;
    }
    case 'unload': {
      try { inflight?.ctl.abort('unload'); } catch {}
      inflight = null;
      initialised = false;
      (self as any).postMessage({ type: 'unloaded' });
      break;
    }
    case 'abort': {
      if (inflight && (!msg.id || msg.id === inflight.id)) {
        try { inflight.ctl.abort('abort'); } catch {}
      }
      break;
    }
    case 'run': {
      if (!initialised) {
        (self as any).postMessage({ type: 'error', id: msg.id, error: 'CPU engine not initialised' });
        return;
      }
      try { inflight?.ctl.abort('preempt'); } catch {}
      const ctl = new AbortController();
      inflight = { id: msg.id, ctl };
      let out = '';
      try {
        if (backend === 'hf' && hfGenerator) {
          const messages = [
            { role: 'system', content: String(msg.systemPrompt || 'You are a helpful assistant.') },
            { role: 'user', content: String(msg.prompt || '') }
          ];
          const maxNew = typeof msg.maxTokens === 'number' && msg.maxTokens > 0 ? msg.maxTokens : 256;
          const doSample = typeof msg.temperature === 'number' ? msg.temperature > 0 : false;
          const top_p = typeof msg.topP === 'number' ? msg.topP : 0.9;
          const result = await hfGenerator(messages as any, { max_new_tokens: maxNew, do_sample: doSample, top_p } as any);
          const text = String((result?.[0]?.generated_text?.at?.(-1)?.content) ?? result?.[0]?.generated_text ?? '');
          out = text;
          (self as any).postMessage({ type: 'done', id: msg.id, text: out });
        } else if (backend === 'onnx' && getOrtSession()) {
          // NOTE: Real generation loop to be implemented with tokenizer + decode.
          // For now, stream a clear placeholder to indicate ORT pipeline is active.
          const text = `[onnx:stub] ${msg.prompt}`;
          for (let i = 0; i < text.length; i += 1) {
            if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const token = text[i];
            out += token;
            (self as any).postMessage({ type: 'token', id: msg.id, token });
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 1));
          }
          (self as any).postMessage({ type: 'done', id: msg.id, text: out });
        } else {
          // Stub fallback
          const text = `[stub] ${msg.prompt}`;
          for (let i = 0; i < text.length; i += 1) {
            if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const token = text[i];
            out += token;
            (self as any).postMessage({ type: 'token', id: msg.id, token });
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 2));
          }
          (self as any).postMessage({ type: 'done', id: msg.id, text: out });
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          (self as any).postMessage({ type: 'aborted', id: msg.id });
        } else {
          (self as any).postMessage({ type: 'error', id: msg.id, error: String(error?.message || error) });
        }
      } finally {
        if (inflight && inflight.id === msg.id) inflight = null;
      }
      break;
    }
    default:
      break;
  }
};

// Expose init status for lightweight probe (optional)
(self as any).__cpu_engine_ready__ = () => initialised;
