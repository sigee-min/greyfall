import { create } from 'zustand';

type Vec2 = {
  x: number;
  y: number;
};

export type TokenState = {
  id: string;
  label: string;
  position: Vec2;
  tint?: number;
  elevation?: number;
  status?: string[];
};

export type ClockState = {
  id: string;
  label: string;
  value: number;
  max: number;
};

export type FogReveal = {
  id: string;
  position: Vec2;
  radius: number;
  falloff?: number;
};

export type FogState = {
  enabled: boolean;
  reveals: FogReveal[];
};

export type SceneState = {
  id: string | null;
  tokens: Record<string, TokenState>;
  clocks: ClockState[];
  fog: FogState;
  ambientLight: number;
};

export type SessionState = {
  scene: SceneState;
  log: { id: string; body: string; at: number }[];
  glow: number;
  corruption: number;
};

export type GreyfallStore = SessionState & {
  selectedTokenId: string | null;
  setScene: (scene: Partial<SceneState>) => void;
  setFog: (fog: Partial<FogState>) => void;
  setFogReveals: (reveals: FogReveal[]) => void;
  upsertToken: (token: TokenState) => void;
  removeToken: (tokenId: string) => void;
  appendLog: (entry: { id: string; body: string }) => void;
  selectToken: (tokenId: string | null) => void;
  hydrate: (snapshot: SessionState) => void;
};

const defaultScene: SceneState = {
  id: null,
  tokens: {},
  clocks: [],
  fog: { enabled: false, reveals: [] },
  ambientLight: 0.6
};

const defaultState: SessionState = {
  scene: defaultScene,
  log: [],
  glow: 3,
  corruption: 0
};

export const useGreyfallStore = create<GreyfallStore>((set) => ({
  ...defaultState,
  selectedTokenId: null,
  setScene: (scene) =>
    set((state) => ({
      scene: {
        ...state.scene,
        ...scene,
        fog: scene.fog ? { ...state.scene.fog, ...scene.fog } : state.scene.fog
      }
    })),
  setFog: (fog) =>
    set((state) => ({
      scene: {
        ...state.scene,
        fog: { ...state.scene.fog, ...fog }
      }
    })),
  setFogReveals: (reveals) =>
    set((state) => ({
      scene: {
        ...state.scene,
        fog: { ...state.scene.fog, reveals }
      }
    })),
  upsertToken: (token) =>
    set((state) => ({
      scene: {
        ...state.scene,
        tokens: {
          ...state.scene.tokens,
          [token.id]: { ...state.scene.tokens[token.id], ...token }
        }
      }
    })),
  removeToken: (tokenId) =>
    set((state) => {
      const nextTokens = { ...state.scene.tokens };
      delete nextTokens[tokenId];
      const nextReveals = state.scene.fog.reveals.filter((reveal) => reveal.id !== tokenId);
      return {
        scene: {
          ...state.scene,
          tokens: nextTokens,
          fog: { ...state.scene.fog, reveals: nextReveals }
        }
      };
    }),
  appendLog: (entry) =>
    set((state) => ({
      log: [...state.log, { ...entry, at: Date.now() }]
    })),
  selectToken: (tokenId) =>
    set(() => ({ selectedTokenId: tokenId })),
  hydrate: (snapshot) =>
    set((state) => ({
      ...snapshot,
      scene: {
        ...snapshot.scene,
        fog: snapshot.scene.fog ?? state.scene.fog
      },
      selectedTokenId: state.selectedTokenId
    }))
}));

export const selectScene = (state: GreyfallStore) => state.scene;
export const selectLog = (state: GreyfallStore) => state.log;
export const selectResources = (state: GreyfallStore) => ({
  glow: state.glow,
  corruption: state.corruption
});

export const selectSelectedTokenId = (state: GreyfallStore) => state.selectedTokenId;
