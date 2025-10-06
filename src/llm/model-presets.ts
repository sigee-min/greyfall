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
    id: 'gemma3n-e4b',
    label: 'Gemma 3n E4B',
    backend: 'cpu',
    manager: 'smart',
    packaging: 'onnx'
  }
];

export function getPresetById(id: string): ModelPreset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

export function listPresets(): ModelPreset[] {
  return [...PRESETS];
}

