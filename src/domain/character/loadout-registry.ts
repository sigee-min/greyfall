import { CharacterLoadout, type CharacterLoadoutSnapshot } from './types';

function cloneLoadout(loadout: CharacterLoadout): CharacterLoadout {
  return {
    ...loadout,
    roll: [...loadout.roll] as [number, number, number],
    stats: { ...loadout.stats },
    passives: loadout.passives.map((passive) => ({ ...passive })),
    traits: loadout.traits.map((trait) => ({
      ...trait,
      statMods: trait.statMods ? { ...trait.statMods } : undefined,
      passives: trait.passives ? trait.passives.map((passive) => ({ ...passive })) : undefined
    }))
  };
}

function toSnapshot(map: Map<string, CharacterLoadout>, revision: number): CharacterLoadoutSnapshot {
  const entries = Array.from(map.values()).map(cloneLoadout);
  const byId: Record<string, CharacterLoadout> = {};
  for (const entry of entries) {
    byId[entry.playerId] = entry;
  }
  return { revision, entries, byId };
}

export class CharacterLoadoutRegistry {
  private revision = 0;
  private readonly map = new Map<string, CharacterLoadout>();
  private snapshot: CharacterLoadoutSnapshot = { revision: 0, entries: [], byId: {} };

  getSnapshot(): CharacterLoadoutSnapshot {
    return this.snapshot;
  }

  get(playerId: string): CharacterLoadout | undefined {
    const entry = this.map.get(playerId);
    return entry ? cloneLoadout(entry) : undefined;
  }

  replace(loadouts: CharacterLoadout[], revisionHint?: number): boolean {
    let changed = this.map.size !== loadouts.length;
    this.map.clear();
    for (const loadout of loadouts) {
      this.map.set(loadout.playerId, cloneLoadout(loadout));
    }
    if (!changed) {
      changed = loadouts.some((loadout) => {
        const snapshot = this.snapshot.byId[loadout.playerId];
        if (!snapshot) return true;
        return snapshot.updatedAt !== loadout.updatedAt || snapshot.built !== loadout.built;
      });
    }
    this.revision = revisionHint ?? this.revision + 1;
    this.snapshot = toSnapshot(this.map, this.revision);
    return changed;
  }

  upsert(loadout: CharacterLoadout): boolean {
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

  remove(playerId: string): boolean {
    const removed = this.map.delete(playerId);
    if (!removed) return false;
    this.revision += 1;
    this.snapshot = toSnapshot(this.map, this.revision);
    return true;
  }

  clear(): boolean {
    if (this.map.size === 0) return false;
    this.map.clear();
    this.revision += 1;
    this.snapshot = toSnapshot(this.map, this.revision);
    return true;
  }

  hasAllBuilt(participantIds: string[]): boolean {
    if (participantIds.length === 0) return false;
    return participantIds.every((id) => this.map.get(id)?.built === true);
  }
}

