import { create } from 'zustand';

export type StatKey = 'Strength' | 'Agility' | 'Engineering' | 'Dexterity' | 'Medicine';

export type Passive = { id: string; name: string; description: string; negative?: boolean };

export type TraitSpec = {
  id: string;
  name: string;
  cost: number; // >0 consumes points, <0 grants points
  statMods?: Partial<Record<StatKey, number>>;
  passives?: Passive[];
  description?: string;
};

export type CharacterSnapshot = {
  built: boolean;
  roll: [number, number, number] | null;
  budget: number;
  remaining: number;
  stats: Record<StatKey, number>;
  passives: Passive[];
  traits: TraitSpec[];
};

export type CharacterState = CharacterSnapshot & {
  setRolled: (dice: [number, number, number]) => void;
  selectTrait: (trait: TraitSpec) => void;
  deselectTrait: (traitId: string) => void;
  finalize: () => void;
  setBuilt: (built: boolean) => void;
  hydrate: (snapshot: CharacterSnapshot) => void;
  reset: () => void;
};

const defaultStats: Record<StatKey, number> = {
  Strength: 0,
  Agility: 0,
  Engineering: 0,
  Dexterity: 0,
  Medicine: 0
};

const createInitialState = (): CharacterSnapshot => ({
  built: false,
  roll: null,
  budget: 0,
  remaining: 0,
  stats: { ...defaultStats },
  passives: [],
  traits: []
});

type DerivedState = {
  remaining: number;
  stats: Record<StatKey, number>;
  passives: Passive[];
};

function mergeStats(base: Record<StatKey, number>, updates: Record<StatKey, number>): Record<StatKey, number> {
  const next = { ...defaultStats };
  for (const key of Object.keys(next) as StatKey[]) {
    if (key in base) next[key] = base[key];
  }
  for (const key of Object.keys(updates) as StatKey[]) {
    next[key] = updates[key];
  }
  return next;
}

function deriveFromTraits(budget: number, traits: TraitSpec[]): DerivedState {
  let remaining = budget;
  const stats: Record<StatKey, number> = { ...defaultStats };
  const passiveMap = new Map<string, Passive>();

  for (const trait of traits) {
    remaining -= trait.cost;
    for (const key in trait.statMods ?? {}) {
      const statKey = key as StatKey;
      const value = trait.statMods?.[statKey] ?? 0;
      stats[statKey] = (stats[statKey] ?? 0) + value;
    }
    for (const passive of trait.passives ?? []) {
      passiveMap.set(passive.id, { ...passive });
    }
  }

  const passives = Array.from(passiveMap.values());
  return { remaining, stats, passives };
}

function cloneSnapshot(snapshot: CharacterSnapshot): CharacterSnapshot {
  return {
    built: snapshot.built,
    roll: snapshot.roll ? ([...snapshot.roll] as [number, number, number]) : null,
    budget: snapshot.budget,
    remaining: snapshot.remaining,
    stats: mergeStats(defaultStats, snapshot.stats),
    passives: snapshot.passives.map((passive) => ({ ...passive })),
    traits: snapshot.traits.map((trait) => ({
      ...trait,
      statMods: trait.statMods ? { ...trait.statMods } : undefined,
      passives: trait.passives ? trait.passives.map((passive) => ({ ...passive })) : undefined
    }))
  };
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  ...createInitialState(),
  setRolled: (dice) => {
    const budget = dice[0] + dice[1] + dice[2];
    set({
      roll: dice,
      budget,
      built: false,
      ...deriveFromTraits(budget, [])
    });
  },
  selectTrait: (trait) => {
    const state = get();
    if (state.traits.some((current) => current.id === trait.id)) return;
    const nextTraits = [...state.traits, trait];
    const derived = deriveFromTraits(state.budget, nextTraits);
    if (derived.remaining < 0) return;
    set({
      traits: nextTraits,
      remaining: derived.remaining,
      stats: derived.stats,
      passives: derived.passives,
      built: false
    });
  },
  deselectTrait: (traitId) => {
    const state = get();
    if (!state.traits.some((trait) => trait.id === traitId)) return;
    const nextTraits = state.traits.filter((trait) => trait.id !== traitId);
    const derived = deriveFromTraits(state.budget, nextTraits);
    set({
      traits: nextTraits,
      remaining: derived.remaining,
      stats: derived.stats,
      passives: derived.passives,
      built: false
    });
  },
  finalize: () => set({ built: true }),
  setBuilt: (built) => set({ built }),
  hydrate: (snapshot) => set(cloneSnapshot(snapshot)),
  reset: () => set(createInitialState())
}));
