import { create } from 'zustand';

const STORAGE_KEY = 'greyfall.preferences';

export type PreferencesState = {
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
  fullscreenEnabled: boolean;
  debugPageEnabled: boolean;
  locale: string;
  loaded: boolean;
  load: () => void;
  setPreference: <K extends PreferenceKey>(key: K, value: PreferencesState[K]) => void;
};

type PreferenceKey =
  | 'musicEnabled'
  | 'musicVolume'
  | 'sfxEnabled'
  | 'sfxVolume'
  | 'fullscreenEnabled'
  | 'debugPageEnabled'
  | 'locale';

type StoredPreferences = Pick<PreferencesState, PreferenceKey>;

function readStoredPreferences(): StoredPreferences | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPreferences;
  } catch (error) {
    console.warn('Failed to parse stored preferences', error);
    return null;
  }
}

function writeStoredPreferences(preferences: StoredPreferences) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to write preferences', error);
  }
}

function detectDefaultLocale(): string {
  try {
    const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
    if (nav.startsWith('ko')) return 'ko';
    return 'en';
  } catch {
    return 'en';
  }
}

const defaultPreferences: StoredPreferences = {
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 0.45,
  sfxVolume: 0.7,
  fullscreenEnabled: true,
  debugPageEnabled: false,
  locale: detectDefaultLocale()
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...defaultPreferences,
  loaded: false,
  load: () => {
    if (get().loaded) return;
    console.info('[preferences] loading');
    const stored = readStoredPreferences();
    if (stored) {
      console.info('[preferences] restored', stored);
      set({ ...defaultPreferences, ...stored, loaded: true });
    } else {
      console.info('[preferences] using defaults', defaultPreferences);
      set({ ...defaultPreferences, loaded: true });
      writeStoredPreferences(defaultPreferences);
    }
  },
  setPreference: (key, value) => {
    set((state) => {
      const current = state[key];
      if (current === value) {
        console.info('[preferences] no change', { key, value });
        return state;
      }
      console.info('[preferences] update', { key, previous: current, value });
      const next = { ...state, [key]: value } as PreferencesState;
      const toStore: StoredPreferences = {
        musicEnabled: next.musicEnabled,
        musicVolume: next.musicVolume,
        sfxEnabled: next.sfxEnabled,
        sfxVolume: next.sfxVolume,
        fullscreenEnabled: next.fullscreenEnabled,
        debugPageEnabled: next.debugPageEnabled,
        locale: next.locale
      };
      writeStoredPreferences(toStore);
      return next;
    });
  }
}));

export const selectMusicEnabled = (state: PreferencesState) => state.musicEnabled;
export const selectMusicVolume = (state: PreferencesState) => state.musicVolume;
export const selectSfxEnabled = (state: PreferencesState) => state.sfxEnabled;
export const selectSfxVolume = (state: PreferencesState) => state.sfxVolume;
export const selectFullscreenEnabled = (state: PreferencesState) => state.fullscreenEnabled;
export const selectDebugPageEnabled = (state: PreferencesState) => state.debugPageEnabled;
export const selectLocale = (state: PreferencesState) => state.locale;
export const selectPreferencesLoaded = (state: PreferencesState) => state.loaded;
