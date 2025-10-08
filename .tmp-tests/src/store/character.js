import { create } from 'zustand';
const defaultStats = {
    Strength: 0,
    Agility: 0,
    Engineering: 0,
    Dexterity: 0,
    Medicine: 0
};
const createInitialState = () => ({
    built: false,
    roll: null,
    budget: 0,
    remaining: 0,
    stats: { ...defaultStats },
    passives: [],
    traits: []
});
function mergeStats(base, updates) {
    const next = { ...defaultStats };
    for (const key of Object.keys(next)) {
        if (key in base)
            next[key] = base[key];
    }
    for (const key of Object.keys(updates)) {
        next[key] = updates[key];
    }
    return next;
}
function deriveFromTraits(budget, traits) {
    let remaining = budget;
    const stats = { ...defaultStats };
    const passiveMap = new Map();
    for (const trait of traits) {
        remaining -= trait.cost;
        for (const key in trait.statMods ?? {}) {
            const statKey = key;
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
function cloneSnapshot(snapshot) {
    return {
        built: snapshot.built,
        roll: snapshot.roll ? [...snapshot.roll] : null,
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
export const useCharacterStore = create((set, get) => ({
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
        if (state.traits.some((current) => current.id === trait.id))
            return;
        const nextTraits = [...state.traits, trait];
        const derived = deriveFromTraits(state.budget, nextTraits);
        if (derived.remaining < 0)
            return;
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
        if (!state.traits.some((trait) => trait.id === traitId))
            return;
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
