import { defineSyncModel, registerSyncModel } from '../net-objects/sync-model.js';
import { CHARACTER_LOADOUT_OBJECT_ID } from '../net-objects/character-ids.js';
import { CharacterLoadoutRegistry } from './loadout-registry.js';
import { TRAITS } from './traits.js';
const STAT_KEYS = ['Strength', 'Agility', 'Engineering', 'Dexterity', 'Medicine'];
const TRAIT_LOOKUP = new Map(TRAITS.map((trait) => [trait.id, trait]));
function cloneTrait(trait) {
    return {
        ...trait,
        statMods: trait.statMods ? { ...trait.statMods } : undefined,
        passives: trait.passives ? trait.passives.map((passive) => ({ ...passive })) : undefined
    };
}
function clonePassive(passive) {
    return { ...passive };
}
function sanitizeLobbyLoadout(playerId, payload) {
    if (playerId !== payload.playerId) {
        console.warn('[character] player mismatch', { playerId, payloadPlayerId: payload.playerId });
        return null;
    }
    const canonicalTraits = [];
    const seen = new Set();
    for (const incoming of payload.traits) {
        const canonical = TRAIT_LOOKUP.get(incoming.id);
        if (!canonical) {
            console.warn('[character] unknown trait', incoming.id);
            return null;
        }
        if (seen.has(canonical.id)) {
            console.warn('[character] duplicate trait', canonical.id);
            return null;
        }
        seen.add(canonical.id);
        canonicalTraits.push(canonical);
    }
    const budget = payload.roll.reduce((sum, die) => sum + die, 0);
    if (budget !== payload.budget) {
        console.warn('[character] budget mismatch', { budget, reported: payload.budget });
        return null;
    }
    let remaining = budget;
    const stats = {
        Strength: 0,
        Agility: 0,
        Engineering: 0,
        Dexterity: 0,
        Medicine: 0
    };
    const passiveMap = new Map();
    for (const trait of canonicalTraits) {
        remaining -= trait.cost;
        if (trait.statMods) {
            for (const key of Object.keys(trait.statMods)) {
                stats[key] = (stats[key] ?? 0) + (trait.statMods?.[key] ?? 0);
            }
        }
        for (const passive of trait.passives ?? []) {
            passiveMap.set(passive.id, clonePassive(passive));
        }
    }
    if (remaining < 0 || remaining !== payload.remaining) {
        console.warn('[character] remaining mismatch', { remaining, reported: payload.remaining });
        return null;
    }
    for (const key of STAT_KEYS) {
        if (payload.stats[key] !== stats[key]) {
            console.warn('[character] stat mismatch', { key, derived: stats[key], reported: payload.stats[key] });
            return null;
        }
    }
    const passives = Array.from(passiveMap.values());
    const incomingPassiveIds = new Set(payload.passives.map((p) => p.id));
    if (incomingPassiveIds.size !== passives.length) {
        console.warn('[character] passive count mismatch');
        return null;
    }
    for (const passive of passives) {
        if (!incomingPassiveIds.has(passive.id)) {
            console.warn('[character] passive mismatch', passive.id);
            return null;
        }
    }
    return {
        playerId,
        roll: [...payload.roll],
        budget,
        remaining,
        stats,
        passives,
        traits: canonicalTraits.map(cloneTrait),
        built: payload.built,
        updatedAt: Date.now()
    };
}
function applySanitizedLoadout(loadout, context) {
    characterLoadoutsHost.update((snapshot) => {
        const registry = new CharacterLoadoutRegistry();
        registry.replace(snapshot.entries, snapshot.revision);
        const changed = registry.upsert(loadout);
        if (!changed)
            return snapshot;
        return registry.getSnapshot();
    }, context);
}
function normalizeSnapshot(input, fallbackInitial) {
    if (!input || typeof input !== 'object')
        return fallbackInitial();
    const raw = input;
    const entries = Array.isArray(raw.entries) ? raw.entries : Array.isArray(raw.loadouts) ? raw.loadouts : [];
    const revision = typeof raw.revision === 'number' && Number.isFinite(raw.revision) ? raw.revision : 0;
    const registry = new CharacterLoadoutRegistry();
    registry.replace(entries, revision);
    return registry.getSnapshot();
}
const characterLoadoutsModel = defineSyncModel({
    id: CHARACTER_LOADOUT_OBJECT_ID,
    initial: () => ({ revision: 0, entries: [], byId: {} }),
    serialize: (data) => ({ revision: data.revision, entries: data.entries }),
    deserialize: (value) => normalizeSnapshot(value, () => ({ revision: 0, entries: [], byId: {} })),
    requestOnStart: true,
    incrementalMax: 32,
    commands: [
        {
            kind: 'character:set',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const candidate = body;
                if (typeof candidate.playerId !== 'string')
                    return null;
                if (!candidate.loadout || typeof candidate.loadout !== 'object')
                    return null;
                const sanitized = sanitizeLobbyLoadout(candidate.playerId, candidate.loadout);
                if (!sanitized)
                    return null;
                return { playerId: candidate.playerId, loadout: sanitized };
            },
            authorize: ({ payload, senderId }) => !senderId || senderId === payload.playerId,
            handle: ({ payload, context }) => {
                const exists = context.lobbyStore.participantsRef.current.some((p) => p.id === payload.playerId);
                if (!exists)
                    return;
                applySanitizedLoadout(payload.loadout, 'character:set');
                if (!payload.loadout.built) {
                    const participant = context.lobbyStore.participantsRef.current.find((p) => p.id === payload.playerId);
                    if (participant?.ready) {
                        context.router.updateParticipantReady(payload.playerId, false, 'character:built-reset');
                    }
                }
            }
        },
        {
            kind: 'character:reset',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { playerId } = body;
                if (typeof playerId !== 'string')
                    return null;
                return playerId;
            },
            authorize: ({ payload, senderId }) => !senderId || senderId === payload,
            handle: ({ payload, context }) => {
                const exists = context.lobbyStore.participantsRef.current.some((p) => p.id === payload);
                if (!exists)
                    return;
                removeCharacterLoadout(payload, 'character:reset');
                const participant = context.lobbyStore.participantsRef.current.find((p) => p.id === payload);
                if (participant?.ready) {
                    context.router.updateParticipantReady(payload, false, 'character:reset');
                }
            }
        }
    ]
});
export const characterLoadoutsSync = registerSyncModel(characterLoadoutsModel);
export function useCharacterLoadouts(selector) {
    return characterLoadoutsSync.use(selector);
}
export const characterLoadoutsHost = characterLoadoutsSync.host;
export function removeCharacterLoadout(playerId, context = 'character:reset') {
    characterLoadoutsHost.update((snapshot) => {
        const registry = new CharacterLoadoutRegistry();
        registry.replace(snapshot.entries, snapshot.revision);
        const changed = registry.remove(playerId);
        if (!changed)
            return snapshot;
        return registry.getSnapshot();
    }, context);
}
export function clearCharacterLoadouts(context = 'character:clear') {
    characterLoadoutsHost.update((snapshot) => {
        if (snapshot.entries.length === 0)
            return snapshot;
        const registry = new CharacterLoadoutRegistry();
        registry.replace(snapshot.entries, snapshot.revision);
        registry.clear();
        return registry.getSnapshot();
    }, context);
}
export function createLobbyLoadoutFromSummary(playerId, summary) {
    if (!summary.roll)
        return null;
    return {
        playerId,
        roll: [...summary.roll],
        budget: summary.budget,
        remaining: summary.remaining,
        stats: { ...summary.stats },
        passives: summary.passives.map(clonePassive),
        traits: summary.traits.map(cloneTrait),
        built: summary.built,
        updatedAt: Date.now()
    };
}
