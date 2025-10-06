import { getPresetById, type ModelPreset } from './model-presets';

// Global, session-scoped active model preset. Set once when host creates a session.
const GLOBAL_KEY = '__greyfall_active_model_preset__';

export function setActiveModelPreset(id: string): ModelPreset | null {
  const preset = getPresetById(id);
  (globalThis as any)[GLOBAL_KEY] = preset ?? null;
  return preset ?? null;
}

export function getActiveModelPreset(): ModelPreset | null {
  return ((globalThis as any)[GLOBAL_KEY] as ModelPreset | null) ?? null;
}

