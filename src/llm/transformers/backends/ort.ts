// Lightweight ONNX Runtime Web loader for worker context.
// Avoid bundling ort by using importScripts at runtime (CDN or served asset).

let ortReady = false as boolean;
let ortNamespace: any = null;

export type OrtConfig = {
  ortScriptUrl?: string; // URL to ort.min.js (optional if already present)
  modelUrl?: string; // ONNX model url (optional for now)
};

export async function ensureOrt(config?: OrtConfig): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (ortReady && ortNamespace) return { ok: true };
  try {
    // Reuse global if present
    if ((self as any).ort) {
      ortNamespace = (self as any).ort;
      ortReady = true;
      return { ok: true };
    }
    if (config?.ortScriptUrl) {
      (self as any).importScripts(config.ortScriptUrl);
      if ((self as any).ort) {
        ortNamespace = (self as any).ort;
        ortReady = true;
        return { ok: true };
      }
    }
    return { ok: false, reason: 'ort-not-available' };
  } catch (e) {
    return { ok: false, reason: String((e as any)?.message || e) };
  }
}

let sessionRef: any = null;

export async function loadOrtSession(config?: OrtConfig): Promise<{ ok: true } | { ok: false; reason: string }> {
  const ok = await ensureOrt(config);
  if (!('ok' in ok) || ok.ok !== true) return ok;
  if (!config?.modelUrl) return { ok: false, reason: 'no-model-url' };
  try {
    const ort = ortNamespace;
    const EP = { executionProviders: ['wasm'] } as any;
    sessionRef = await ort.InferenceSession.create(config.modelUrl, EP);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String((e as any)?.message || e) };
  }
}

export function getOrtSession() {
  return sessionRef;
}

