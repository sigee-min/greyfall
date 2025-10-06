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
    manager: 'smart',
    packaging: 'onnx',
    appConfig: {
      // Transformers.js (HF) quick path
      hfModelId: 'onnx-community/gemma-3-1b-it-ONNX-GQA',
      dtype: 'q4'
    }
  },
  {
    id: 'granite-micro',
    label: 'Granite 4.0 Micro (ONNX)',
    backend: 'cpu',
    manager: 'smart',
    packaging: 'onnx',
    appConfig: {
      hfModelId: 'onnx-community/granite-4.0-micro-ONNX-web',
      device: 'webgpu'
    }
  }
];

export function getPresetById(id: string): ModelPreset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

export function listPresets(): ModelPreset[] {
  return [...PRESETS];
}
