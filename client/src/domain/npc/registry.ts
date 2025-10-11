import { actorsMeta } from '../net-objects/actors-meta.js';
import { worldNpcs } from '../net-objects/world-npcs.js';
import { getHostObject } from '../net-objects/registry.js';
import { WORLD_ACTORS_OBJECT_ID } from '../net-objects/object-ids.js';
import type { HostWorldActorsObject } from '../net-objects/world-actors-host.js';
import type { NpcProfile } from './types';
import type { StatKey } from '../stats/keys';
import { npcBaseStats } from './base-stats';
import { mapActorToProfile, unmapActor } from './profile-registry';

export type SpawnSeed = {
  id: string;
  name?: string;
  faction?: string;
  hp?: { cur: number; max: number };
  inventory?: Array<{ key: string; count: number }>;
  equipment?: string[];
  stance?: 'idle' | 'patrol' | 'engage' | 'flee';
  mood?: 'calm' | 'tense' | 'angry' | 'afraid';
};

export function spawnNpc(profile: NpcProfile, seed: SpawnSeed): boolean {
  const id = seed.id;
  // 1) Register meta
  actorsMeta.host.upsertMany?.([{ id, kind: 'npc', profileId: profile.id, faction: seed.faction ?? profile.faction }], 'npc:spawn:meta');
  // 2) Publish public info
  worldNpcs.host.upsertMany?.([
    {
      id,
      name: seed.name ?? profile.name,
      kind: profile.kind,
      faction: seed.faction ?? profile.faction,
      stance: seed.stance ?? 'idle',
      mood: seed.mood ?? 'calm',
      hp: seed.hp ?? { cur: profile.baseStats.Strength + 5, max: profile.baseStats.Strength + 5 } // simple default
    }
  ], 'npc:spawn');
  // 3) Authority base stats map
  try {
    const map = (npcBaseStats.host.getObject()?.getSnapshot()?.value as Record<string, Record<StatKey, number>> | undefined) ?? {};
    const next = { ...map, [id]: profile.baseStats } as Record<string, Record<StatKey, number>>;
    npcBaseStats.host.set?.(next, 'npc:spawn:base');
  } catch {}
  try { mapActorToProfile(id, profile); } catch {}
  // 4) Ensure actor entry with initial equipment/inventory/hp
  const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
  if (!actors) return false;
  actors.ensure(id, { hp: seed.hp, inventory: seed.inventory, equipment: seed.equipment });
  // 5) Recompute equipment snapshot using base stats
  try {
    (actors as unknown as { recomputeEquipmentSnapshot: (id: string) => void }).recomputeEquipmentSnapshot(id);
  } catch {}
  return true;
}

export function despawnNpc(id: string): boolean {
  try { worldNpcs.host.removeById?.(id, 'npc:despawn'); } catch {}
  try { actorsMeta.host.removeById?.(id, 'npc:despawn:meta'); } catch {}
  try {
    const map = (npcBaseStats.host.getObject()?.getSnapshot()?.value as Record<string, Record<StatKey, number>> | undefined) ?? {};
    if (map[id]) {
      const next = { ...map };
      delete next[id];
      npcBaseStats.host.set?.(next, 'npc:despawn:base');
    }
  } catch {}
  try { unmapActor(id); } catch {}
  return true;
}
