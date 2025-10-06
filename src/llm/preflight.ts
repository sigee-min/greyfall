import type { EngineBackend } from './webllm-engine';
import { getPresetById } from './model-presets';

export type PreflightResult = { ok: true } | { ok: false; reason: string };

export async function preflightForModel(modelId: string): Promise<PreflightResult> {
  const preset = getPresetById(modelId);
  if (!preset) return { ok: false, reason: 'unknown-model' };
  if (preset.backend === 'gpu') return preflightGpu();
  return preflightCpu();
}

export async function preflightBackend(backend: EngineBackend): Promise<PreflightResult> {
  return backend === 'gpu' ? preflightGpu() : preflightCpu();
}

export async function preflightGpu(): Promise<PreflightResult> {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  if (!window.isSecureContext) return { ok: false, reason: 'insecure-context' };
  const nav = navigator as Navigator & { gpu?: unknown };
  if (!('gpu' in nav) || !nav.gpu) return { ok: false, reason: 'no-webgpu' };
  return { ok: true };
}

export async function preflightCpu(): Promise<PreflightResult> {
  // Baseline WASM check; Threads/SIMD are optional and can be tested later if enabled
  try {
    if (typeof WebAssembly === 'undefined') return { ok: false, reason: 'no-wasm' };
  } catch {
    return { ok: false, reason: 'no-wasm' };
  }
  return { ok: true };
}

