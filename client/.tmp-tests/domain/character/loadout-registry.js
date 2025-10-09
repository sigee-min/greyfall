function cloneLoadout(loadout) {
    return {
        ...loadout,
        stats: { ...loadout.stats },
        passives: loadout.passives.map((passive) => ({ ...passive })),
        traits: loadout.traits.map((trait) => ({
            ...trait,
            statMods: trait.statMods ? { ...trait.statMods } : undefined,
            passives: trait.passives ? trait.passives.map((passive) => ({ ...passive })) : undefined
        }))
    };
}
function toSnapshot(map, revision) {
    const entries = Array.from(map.values()).map(cloneLoadout);
    const byId = {};
    for (const entry of entries) {
        byId[entry.playerId] = entry;
    }
    return { revision, entries, byId };
}
export class CharacterLoadoutRegistry {
    constructor() {
        this.revision = 0;
        this.map = new Map();
        this.snapshot = { revision: 0, entries: [], byId: {} };
    }
    getSnapshot() {
        return this.snapshot;
    }
    get(playerId) {
        const entry = this.map.get(playerId);
        return entry ? cloneLoadout(entry) : undefined;
    }
    replace(loadouts, revisionHint) {
        let changed = this.map.size !== loadouts.length;
        this.map.clear();
        for (const loadout of loadouts) {
            this.map.set(loadout.playerId, cloneLoadout(loadout));
        }
        if (!changed) {
            changed = loadouts.some((loadout) => {
                const snapshot = this.snapshot.byId[loadout.playerId];
                if (!snapshot)
                    return true;
                return snapshot.updatedAt !== loadout.updatedAt || snapshot.built !== loadout.built;
            });
        }
        this.revision = revisionHint ?? this.revision + 1;
        this.snapshot = toSnapshot(this.map, this.revision);
        return changed;
    }
    upsert(loadout) {
        const previous = this.map.get(loadout.playerId);
        if (previous && previous.updatedAt === loadout.updatedAt && previous.built === loadout.built) {
            this.map.set(loadout.playerId, cloneLoadout(loadout));
            return false;
        }
        this.map.set(loadout.playerId, cloneLoadout(loadout));
        this.revision += 1;
        this.snapshot = toSnapshot(this.map, this.revision);
        return true;
    }
    remove(playerId) {
        const removed = this.map.delete(playerId);
        if (!removed)
            return false;
        this.revision += 1;
        this.snapshot = toSnapshot(this.map, this.revision);
        return true;
    }
    clear() {
        if (this.map.size === 0)
            return false;
        this.map.clear();
        this.revision += 1;
        this.snapshot = toSnapshot(this.map, this.revision);
        return true;
    }
    hasAllBuilt(participantIds) {
        if (participantIds.length === 0)
            return false;
        return participantIds.every((id) => this.map.get(id)?.built === true);
    }
}
