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
  // Camera and world state for stage/minimap
  camera: { x: number; y: number; scale: number; minScale: number; maxScale: number };
  world: { width: number; height: number };
  minimap: { enabled: boolean; sizeMode: 'auto' | 'ultra' | 'desktop-large' | 'tablet' | 'mobile' | 'custom'; customSize?: number; showFog: boolean; showTokens: boolean; clusterThreshold: number; opacity: number };
  setScene: (scene: Partial<SceneState>) => void;
  setFog: (fog: Partial<FogState>) => void;
  setFogReveals: (reveals: FogReveal[]) => void;
  upsertToken: (token: TokenState) => void;
  removeToken: (tokenId: string) => void;
  appendLog: (entry: { id: string; body: string }) => void;
  selectToken: (tokenId: string | null) => void;
  hydrate: (snapshot: SessionState) => void;
  // Camera/world/minimap actions
  setCamera: (patch: Partial<GreyfallStore['camera']>) => void;
  centerOn: (x: number, y: number) => void;
  panBy: (dx: number, dy: number) => void;
  zoomTo: (scale: number) => void;
  setWorldSize: (size: Partial<GreyfallStore['world']>) => void;
  setMinimap: (patch: Partial<GreyfallStore['minimap']>) => void;
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
  camera: { x: 2048, y: 2048, scale: 1, minScale: 0.5, maxScale: 4 },
  world: { width: 4096, height: 4096 },
  minimap: { enabled: true, sizeMode: 'auto', showFog: true, showTokens: true, clusterThreshold: 3, opacity: 0.9 },
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
    })),
  setCamera: (patch) =>
    set((state) => ({ camera: { ...state.camera, ...patch } })),
  centerOn: (x, y) => set((state) => ({ camera: { ...state.camera, x, y } })),
  panBy: (dx, dy) => set((state) => ({ camera: { ...state.camera, x: state.camera.x + dx, y: state.camera.y + dy } })),
  zoomTo: (scale) => set((state) => ({ camera: { ...state.camera, scale: Math.max(state.camera.minScale, Math.min(state.camera.maxScale, scale)) } })),
  setWorldSize: (size) => set((state) => ({ world: { ...state.world, ...size } })),
  setMinimap: (patch) => set((state) => ({ minimap: { ...state.minimap, ...patch } }))
}));

export const selectScene = (state: GreyfallStore) => state.scene;
export const selectLog = (state: GreyfallStore) => state.log;
export const selectResources = (state: GreyfallStore) => ({
  glow: state.glow,
  corruption: state.corruption
});

export const selectSelectedTokenId = (state: GreyfallStore) => state.selectedTokenId;
export const selectCamera = (state: GreyfallStore) => state.camera;
export const selectWorld = (state: GreyfallStore) => state.world;
export const selectMinimap = (state: GreyfallStore) => state.minimap;
