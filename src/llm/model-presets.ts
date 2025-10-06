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
    // Fill these URLs when your assets/CDN are ready
    appConfig: {
      // Example: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js'
      ortScriptUrl: '',
      // Example model url served by your app/CDN: '/models/gemma3-1b/model.onnx'
      modelUrl: ''
    }
  }
];

export function getPresetById(id: string): ModelPreset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

export function listPresets(): ModelPreset[] {
  return [...PRESETS];
}
