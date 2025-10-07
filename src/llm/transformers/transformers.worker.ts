// Transformers.js worker skeleton. Replace internals with ONNX/llama.cpp later.

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
let hfGenerator: any | null = null;

import { pipeline, TextStreamer, env } from '@huggingface/transformers';
// transformers가 기본으로 설정하는 CDN( jsDelivr ) wasmPaths를 비활성화하여
// onnxruntime-web의 번들된 MJS 경로(import.meta.url 기반)를 사용하게 합니다.
try {
  (env as any).backends = (env as any).backends || {};
  (env as any).backends.onnx = (env as any).backends.onnx || {};
  (env as any).backends.onnx.wasm = (env as any).backends.onnx.wasm || {};
  // undefined/null로 두면 onnxruntime-web이 자체 내장 모듈 경로를 사용합니다.
  delete (env as any).backends.onnx.wasm.wasmPaths;
} catch {}

function emitProgress(text: string, progress?: number) {
  (self as any).postMessage({ type: 'progress', text, progress });
}

type ReadyzMsg = { type: 'readyz'; id: string };
type InMessageEx = InMessage | ReadyzMsg;

self.onmessage = async (evt: MessageEvent<InMessageEx>) => {
  const msg = evt.data;
  switch (msg.type) {
    case 'init': {
      emitProgress('심판자를 준비하고 있어요…', 0.1);
      const cfg = (msg.appConfig || {}) as any;
      // Preferred: Transformers.js pipeline (downloads from HF Hub by default)
      {
        const { hfModelId, ...opts } = (cfg || {}) as Record<string, unknown>;
        if (!hfModelId) {
          try { console.error('[transformers] pipeline init failed:', 'Missing hfModelId'); } catch {}
        } else {
          emitProgress('필요한 파일을 불러오는 중이에요…', 0.25);
          hfGenerator = await pipeline('text-generation', String(hfModelId), opts as any).catch((e: any) => {
            try { console.error('[transformers] pipeline init failed:', String(e?.message || e)); } catch {}
            return null as any;
          });
          if (hfGenerator) emitProgress('거의 준비됐어요…', 0.9);
        }
      }
      initialised = !(hfGenerator == null || hfGenerator == undefined);
      if (initialised) {
        // 최종 단계 표시는 "완료" 키워드를 포함해야 상위 엔진에서 준비 상태를 감지합니다.
        emitProgress('심판자 준비 완료!', 0.95);
      } else {
        emitProgress('오프라인 상태거나 모델을 가져오지 못했어요.', 0.21);
      }
      break;
    }
    case 'readyz': {
      (self as any).postMessage({ type: 'readyz', id: (msg as ReadyzMsg).id, ok: Boolean(hfGenerator) });
      break;
    }
    case 'unload': {
      inflight = null;
      initialised = false;
      (self as any).postMessage({ type: 'unloaded' });
      break;
    }
    case 'abort': {
      // No-op best-effort for now (no native abort on pipeline)
      break;
    }
    case 'run': {
      if (!initialised) {
        (self as any).postMessage({ type: 'error', id: msg.id, error: 'Transformers engine not initialised' });
        return;
      }
      inflight = { id: msg.id, ctl: new AbortController() } as any;
      let out = '';
      try {
        if (!hfGenerator) throw new Error('Transformers generator not ready');
        const messages = [
          { role: 'system', content: String(msg.systemPrompt || 'You are a helpful assistant.') },
          { role: 'user', content: String(msg.prompt || '') }
        ];
        const maxNew = typeof msg.maxTokens === 'number' && msg.maxTokens > 0 ? msg.maxTokens : 128;
        const doSample = typeof msg.temperature === 'number' ? msg.temperature > 0 : false;
        const top_p = typeof msg.topP === 'number' ? msg.topP : 0.9;

        let streamed = '';
        const streamer = new TextStreamer((hfGenerator as any).tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (text: string) => {
            streamed += text;
            (self as any).postMessage({ type: 'token', id: msg.id, token: text });
          }
        } as any);

        const res = await hfGenerator(messages as any, {
          max_new_tokens: maxNew,
          do_sample: doSample,
          top_p,
          streamer
        } as any);
        out = String((res?.[0]?.generated_text?.at?.(-1)?.content) ?? streamed ?? '');
        (self as any).postMessage({ type: 'done', id: msg.id, text: out });
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
(self as any).__transformers_engine_ready__ = () => initialised;
