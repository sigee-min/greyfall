// CPU WASM worker skeleton. Replace internals with ONNX/llama.cpp later.

type InitMsg = { type: 'init'; modelId: string; threads?: number; simd?: boolean };
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

function emitProgress(text: string, progress?: number) {
  (self as any).postMessage({ type: 'progress', text, progress });
}

self.onmessage = async (evt: MessageEvent<InMessage>) => {
  const msg = evt.data;
  switch (msg.type) {
    case 'init': {
      // TODO: load tokenizer/runtime/model shards
      emitProgress('엔진 초기화 중 (CPU)', 0.1);
      // Simulate light work
      await new Promise((r) => setTimeout(r, 50));
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
      // Stub streaming: echo prompt length as dots
      let out = '';
      try {
        const text = `[stub] ${msg.prompt}`;
        for (let i = 0; i < text.length; i += 1) {
          if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const token = text[i];
          out += token;
          (self as any).postMessage({ type: 'token', id: msg.id, token });
          // small delay to emulate streaming
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 2));
        }
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
(self as any).__cpu_engine_ready__ = () => initialised;

