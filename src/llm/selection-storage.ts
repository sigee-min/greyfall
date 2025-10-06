import { setActiveModelPreset, getActiveModelPreset } from './engine-selection';

const KEY = 'greyfall.activeModelId';

export function persistActiveModel(): void {
  try {
    const cur = getActiveModelPreset();
    if (!cur) return;
    localStorage.setItem(KEY, cur.id);
  } catch {}
}

export function loadPersistedModel(): string | null {
  try {
    const id = localStorage.getItem(KEY);
    if (id) setActiveModelPreset(id);
    return id;
  } catch {
    return null;
  }
}

export function chooseModel(id: string): boolean {
  const preset = setActiveModelPreset(id);
  if (!preset) return false;
  persistActiveModel();
  return true;
}

