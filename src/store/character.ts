import { create } from 'zustand';

export type StatKey = '근력' | '운동신경' | '공학' | '손재주' | '의술';

export type Passive = { id: string; name: string; description: string; negative?: boolean };

export type TraitSpec = {
  id: string;
  name: string;
  cost: number; // >0 consumes points, <0 grants points
  statMods?: Partial<Record<StatKey, number>>;
  passives?: Passive[];
  description?: string;
};

export type CharacterState = {
  built: boolean;
  roll: [number, number, number] | null;
  budget: number; // total points rolled (3d6)
  remaining: number; // remaining after selected traits
  stats: Record<StatKey, number>;
  passives: Passive[];
  traits: TraitSpec[]; // selected
  setRolled: (dice: [number, number, number]) => void;
  selectTrait: (trait: TraitSpec) => void;
  deselectTrait: (traitId: string) => void;
  finalize: () => void;
  reset: () => void;
};

const defaultStats: Record<StatKey, number> = {
  근력: 0,
  운동신경: 0,
  공학: 0,
  손재주: 0,
  의술: 0
};

export const useCharacterStore = create<CharacterState>((set, get) => ({
  built: false,
  roll: null,
  budget: 0,
  remaining: 0,
  stats: { ...defaultStats },
  passives: [],
  traits: [],
  setRolled: (dice) => {
    const budget = dice[0] + dice[1] + dice[2];
    set({ roll: dice, budget, remaining: budget, stats: { ...defaultStats }, passives: [], traits: [] });
  },
  selectTrait: (trait) => {
    const state = get();
    // compute new remaining
    const nextRemaining = state.remaining - trait.cost;
    if (nextRemaining < 0) return; // do not allow overspend
    // apply stat mods
    const nextStats = { ...state.stats };
    for (const k in trait.statMods ?? {}) {
      const key = k as StatKey;
      nextStats[key] = (nextStats[key] ?? 0) + (trait.statMods![key] ?? 0);
    }
    const nextPassives = [...state.passives, ...(trait.passives ?? [])];
    const nextTraits = [...state.traits, trait];
    set({ remaining: nextRemaining, stats: nextStats, passives: nextPassives, traits: nextTraits });
  },
  deselectTrait: (traitId) => {
    const state = get();
    const trait = state.traits.find((t) => t.id === traitId);
    if (!trait) return;
    // revert
    const nextRemaining = state.remaining + trait.cost;
    const nextStats = { ...state.stats };
    for (const k in trait.statMods ?? {}) {
      const key = k as StatKey;
      nextStats[key] = (nextStats[key] ?? 0) - (trait.statMods![key] ?? 0);
    }
    const nextPassives = state.passives.filter((p) => !(trait.passives ?? []).some((tp) => tp.id === p.id));
    const nextTraits = state.traits.filter((t) => t.id !== traitId);
    set({ remaining: nextRemaining, stats: nextStats, passives: nextPassives, traits: nextTraits });
  },
  finalize: () => set({ built: true }),
  reset: () => set({ built: false, roll: null, budget: 0, remaining: 0, stats: { ...defaultStats }, passives: [], traits: [] })
}));

