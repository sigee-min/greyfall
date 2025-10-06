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
      // Optional direct ORT fallback (self-hosted)
      // ortScriptUrl: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.min.js',
      // modelUrl: '/models/gemma3-1b/model.onnx'
    }
  },
  {
    id: 'qwen-4b',
    label: 'Qwen 4B (ONNX)',
    backend: 'cpu',
    manager: 'smart',
    packaging: 'onnx',
    appConfig: {
      // Replace with the exact HF repo when finalized
      hfModelId: 'onnx-community/Qwen2-4B-Instruct-ONNX',
      dtype: 'q4'
    }
  }
];

export function getPresetById(id: string): ModelPreset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

export function listPresets(): ModelPreset[] {
  return [...PRESETS];
}
