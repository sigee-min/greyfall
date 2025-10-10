import { create } from 'zustand';
import type { MissionState } from '../equipment/policy';

type MissionStore = {
  state: MissionState;
  set: (next: MissionState) => void;
};

export const useMissionStore = create<MissionStore>((set) => ({
  state: 'safe',
  set: (next) => set({ state: next })
}));

export function getMissionState(): MissionState {
  try {
    return useMissionStore.getState().state;
  } catch {
    return 'safe';
  }
}

