import type { HostObject, CommonDeps } from './types';
import { HostKeyedListObject } from './base/keyed-list-object.js';
import { registerNetObject, HostAckFallback } from './registry.js';
import type { ActorEntry, ActorInventoryItem } from './world-actors-client';
import { worldActorsClient } from './world-actors-client.js';
import { WORLD_ACTORS_OBJECT_ID } from './object-ids.js';
import { itemSlot, slotCapacity } from '../world/equipment-rules.js';

export { WORLD_ACTORS_OBJECT_ID } from './object-ids.js';

export class HostWorldActorsObject implements HostObject {
  readonly id = WORLD_ACTORS_OBJECT_ID;
  private readonly list: HostKeyedListObject<ActorEntry>;
  constructor(private deps: CommonDeps) {
    this.list = new HostKeyedListObject<ActorEntry>(deps, this.id, { path: 'list', initial: [], context: 'world:actors:init' });
  }

  onRequest(sinceRev?: number) {
    return this.list.onRequest(sinceRev);
  }

  getAll(): ActorEntry[] {
    const snap = this.list.getSnapshot()?.value as any;
    return Array.isArray(snap?.list) ? (snap.list as ActorEntry[]) : [];
  }

  ensure(id: string, defaults?: Partial<ActorEntry>): ActorEntry {
    const cur = this.getAll().find((a) => a.id === id);
    if (cur) return cur;
    const entry: ActorEntry = { id, hp: defaults?.hp, status: defaults?.status ?? [], inventory: defaults?.inventory ?? [], equipment: defaults?.equipment ?? [] };
    this.list.upsertMany([entry], 'world:actors:ensure');
    return entry;
  }

  hpAdd(id: string, delta: number): boolean {
    const list = this.getAll();
    const e = list.find((a) => a.id === id) ?? this.ensure(id, { hp: { cur: 0, max: 10 } });
    const hp = e.hp ?? { cur: 0, max: 10 };
    const next: ActorEntry = { ...e, hp: { cur: Math.max(0, Math.min(hp.max, hp.cur + delta)), max: hp.max } };
    return this.list.upsertMany([next], 'actors:hpAdd');
  }

  statusAdd(id: string, status: string): boolean {
    const list = this.getAll();
    const e = list.find((a) => a.id === id) ?? this.ensure(id);
    const s = Array.isArray(e.status) ? e.status.slice() : [];
    if (!s.includes(status)) s.push(status);
    return this.list.upsertMany([{ ...e, status: s }], 'actors:statusAdd');
  }

  statusRemove(id: string, status: string): boolean {
    const list = this.getAll();
    const e = list.find((a) => a.id === id) ?? this.ensure(id);
    const s = Array.isArray(e.status) ? e.status.filter((x) => x !== status) : [];
    return this.list.upsertMany([{ ...e, status: s }], 'actors:statusRemove');
  }

  private adjustInventory(arr: ActorInventoryItem[] | undefined, key: string, delta: number): ActorInventoryItem[] {
    const items = Array.isArray(arr) ? arr.slice() : [];
    const idx = items.findIndex((i) => i.key === key);
    if (idx < 0) {
      if (delta > 0) items.push({ key, count: delta });
      return items;
    }
    const next = Math.max(0, (items[idx].count || 0) + delta);
    if (next <= 0) items.splice(idx, 1);
    else items[idx] = { key, count: next };
    return items;
  }

  transferItem(fromId: string, toId: string, key: string, count = 1): boolean {
    if (!key || count <= 0) return false;
    const list = this.getAll();
    const from = list.find((a) => a.id === fromId) ?? this.ensure(fromId);
    const to = list.find((a) => a.id === toId) ?? this.ensure(toId);
    const have = (from.inventory ?? []).find((i) => i.key === key)?.count ?? 0;
    if (have < count) return false;
    const fromInv = this.adjustInventory(from.inventory, key, -count);
    const toInv = this.adjustInventory(to.inventory, key, count);
    return this.list.upsertMany([{ ...from, inventory: fromInv }, { ...to, inventory: toInv }], 'actors:inventory:transfer');
  }

  transferFirstAvailableItem(fromId: string, toId: string): boolean {
    const list = this.getAll();
    const from = list.find((a) => a.id === fromId);
    if (!from || !Array.isArray(from.inventory) || from.inventory.length === 0) return false;
    const item = from.inventory.find((i) => (i.count ?? 0) > 0);
    if (!item) return false;
    return this.transferItem(fromId, toId, item.key, 1);
  }

  equipItem(actorId: string, key: string): boolean {
    if (!key) return false;
    const list = this.getAll();
    const e = list.find((a) => a.id === actorId) ?? this.ensure(actorId);
    const have = (e.inventory ?? []).find((i) => i.key === key)?.count ?? 0;
    if (have <= 0) return false;
    // Enforce slot capacities
    const slot = itemSlot(key);
    const cap = slotCapacity(slot);
    const eq = Array.isArray(e.equipment) ? e.equipment.slice() : [];
    const curInSlot = eq.filter((k) => itemSlot(k) === slot).length;
    if (curInSlot >= cap) {
      // Reject equipping beyond capacity to prevent abuse (e.g., multiple hats)
      return false;
    }
    const inv = this.adjustInventory(e.inventory, key, -1);
    eq.push(key);
    return this.list.upsertMany([{ ...e, inventory: inv, equipment: eq }], 'actors:equipment:equip');
  }

  unequipItem(actorId: string, key: string): boolean {
    if (!key) return false;
    const list = this.getAll();
    const e = list.find((a) => a.id === actorId) ?? this.ensure(actorId);
    const eq = Array.isArray(e.equipment) ? e.equipment.slice() : [];
    const idx = eq.indexOf(key);
    if (idx < 0) return false;
    eq.splice(idx, 1);
    const inv = this.adjustInventory(e.inventory, key, 1);
    return this.list.upsertMany([{ ...e, inventory: inv, equipment: eq }], 'actors:equipment:unequip');
  }
}

registerNetObject({
  id: WORLD_ACTORS_OBJECT_ID,
  host: {
    create: (deps) => new HostWorldActorsObject(deps),
    ack: {
      incrementalMax: 64,
      fallbackStrategy: HostAckFallback.Snapshot
    },
    onPeerConnect: (object) => { object.onRequest(undefined); }
  },
  client: {
    create: () => worldActorsClient,
    requestOnStart: true,
    requestContext: 'request world actors'
  }
});
