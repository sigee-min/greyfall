// Model preset registry and backend mapping decided by product policy.

export type ComputeBackend = 'gpu' | 'cpu';

export type ModelPreset = {
  id: string; // canonical id shown to users
  label: string; // human-friendly
  backend: ComputeBackend; // chosen compute path for this model
  manager: 'fast' | 'smart'; // maps to existing LlmManagerKind
  packaging: 'mlc' | 'onnx' | 'gguf';
  appConfig?: Record<string, unknown>; // optional engine-specific config
};

// Product defaults: extend as more models are added.
const PRESETS: ModelPreset[] = [
  {
    id: 'gemma3-1b',
    label: 'Gemma 3 1B (ONNX)',
    backend: 'cpu',
    manager: 'fast',
    packaging: 'onnx',
    appConfig: {
      // Transformers.js (HF) quick path
      hfModelId: 'onnx-community/gemma-3-1b-it-ONNX-GQA',
      dtype: 'q8',
      threads: 1, // safer default unless cross-origin isolation enabled
      simd: true
    }
  },
  {
    id: 'gemma3-1b',
    label: 'Gemma 3 1B (WebGPU Q4)',
    backend: 'gpu',
    manager: 'smart',
    packaging: 'onnx',
    appConfig: {
      hfModelId: 'onnx-community/gemma-3-1b-it-ONNX-GQA',
      dtype: 'q4',
      device: 'webgpu'
    }
  },
  {
    id: 'cpu-test',
    label: 'CPU Test (ONNX)',
    backend: 'cpu',
    manager: 'fast',
    packaging: 'onnx',
    appConfig: {
      // Small CPU-friendly model for quick testing
      hfModelId: 'onnx-community/gemma-3-270m-it-ONNX',
      dtype: 'fp32'
    }
  }
];

export function getPresetById(id: string): ModelPreset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

export function listPresets(): ModelPreset[] {
  return [...PRESETS];
}
