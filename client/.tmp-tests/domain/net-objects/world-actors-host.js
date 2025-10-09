import { HostKeyedListObject } from './base/keyed-list-object.js';
import { registerNetObject, HostAckFallback } from './registry.js';
import { worldActorsClient } from './world-actors-client.js';
import { WORLD_ACTORS_OBJECT_ID } from './object-ids.js';
import { itemSlot, slotCapacity } from '../world/equipment-rules.js';
export { WORLD_ACTORS_OBJECT_ID } from './object-ids.js';
export class HostWorldActorsObject {
    constructor(deps) {
        this.deps = deps;
        this.id = WORLD_ACTORS_OBJECT_ID;
        this.list = new HostKeyedListObject(deps, this.id, { path: 'list', initial: [], context: 'world:actors:init' });
    }
    onRequest(sinceRev) {
        return this.list.onRequest(sinceRev);
    }
    getAll() {
        const snap = this.list.getSnapshot()?.value;
        return Array.isArray(snap?.list) ? snap.list : [];
    }
    ensure(id, defaults) {
        const cur = this.getAll().find((a) => a.id === id);
        if (cur)
            return cur;
        const entry = { id, hp: defaults?.hp, status: defaults?.status ?? [], inventory: defaults?.inventory ?? [], equipment: defaults?.equipment ?? [] };
        this.list.upsertMany([entry], 'world:actors:ensure');
        return entry;
    }
    hpAdd(id, delta) {
        const list = this.getAll();
        const e = list.find((a) => a.id === id) ?? this.ensure(id, { hp: { cur: 0, max: 10 } });
        const hp = e.hp ?? { cur: 0, max: 10 };
        const next = { ...e, hp: { cur: Math.max(0, Math.min(hp.max, hp.cur + delta)), max: hp.max } };
        return this.list.upsertMany([next], 'actors:hpAdd');
    }
    statusAdd(id, status) {
        const list = this.getAll();
        const e = list.find((a) => a.id === id) ?? this.ensure(id);
        const s = Array.isArray(e.status) ? e.status.slice() : [];
        if (!s.includes(status))
            s.push(status);
        return this.list.upsertMany([{ ...e, status: s }], 'actors:statusAdd');
    }
    statusRemove(id, status) {
        const list = this.getAll();
        const e = list.find((a) => a.id === id) ?? this.ensure(id);
        const s = Array.isArray(e.status) ? e.status.filter((x) => x !== status) : [];
        return this.list.upsertMany([{ ...e, status: s }], 'actors:statusRemove');
    }
    adjustInventory(arr, key, delta) {
        const items = Array.isArray(arr) ? arr.slice() : [];
        const idx = items.findIndex((i) => i.key === key);
        if (idx < 0) {
            if (delta > 0)
                items.push({ key, count: delta });
            return items;
        }
        const next = Math.max(0, (items[idx].count || 0) + delta);
        if (next <= 0)
            items.splice(idx, 1);
        else
            items[idx] = { key, count: next };
        return items;
    }
    transferItem(fromId, toId, key, count = 1) {
        if (!key || count <= 0)
            return false;
        const list = this.getAll();
        const from = list.find((a) => a.id === fromId) ?? this.ensure(fromId);
        const to = list.find((a) => a.id === toId) ?? this.ensure(toId);
        const have = (from.inventory ?? []).find((i) => i.key === key)?.count ?? 0;
        if (have < count)
            return false;
        const fromInv = this.adjustInventory(from.inventory, key, -count);
        const toInv = this.adjustInventory(to.inventory, key, count);
        return this.list.upsertMany([{ ...from, inventory: fromInv }, { ...to, inventory: toInv }], 'actors:inventory:transfer');
    }
    transferFirstAvailableItem(fromId, toId) {
        const list = this.getAll();
        const from = list.find((a) => a.id === fromId);
        if (!from || !Array.isArray(from.inventory) || from.inventory.length === 0)
            return false;
        const item = from.inventory.find((i) => (i.count ?? 0) > 0);
        if (!item)
            return false;
        return this.transferItem(fromId, toId, item.key, 1);
    }
    equipItem(actorId, key) {
        if (!key)
            return false;
        const list = this.getAll();
        const e = list.find((a) => a.id === actorId) ?? this.ensure(actorId);
        const have = (e.inventory ?? []).find((i) => i.key === key)?.count ?? 0;
        if (have <= 0)
            return false;
        // Enforce slot capacities with auto-replacement
        const slot = itemSlot(key);
        const cap = slotCapacity(slot);
        const eq = Array.isArray(e.equipment) ? e.equipment.slice() : [];
        const inSlotIdxs = eq.map((k, i) => ({ k, i })).filter((p) => itemSlot(p.k) === slot).map((p) => p.i);
        let inv = e.inventory ?? [];
        if (inSlotIdxs.length >= cap) {
            // Remove as many existing items from this slot as needed to make room for 1
            const toRemove = inSlotIdxs.length - cap + 1;
            for (let n = 0; n < toRemove; n += 1) {
                // Remove oldest first (lowest index)
                const rmIdx = inSlotIdxs[n];
                const rmKey = eq[rmIdx];
                // Actually splice from eq; adjust subsequent indices
                eq.splice(rmIdx - n, 1);
                // Return removed item to inventory
                inv = this.adjustInventory(inv, rmKey, +1);
            }
        }
        // Consume item from inventory and equip
        inv = this.adjustInventory(inv, key, -1);
        eq.push(key);
        return this.list.upsertMany([{ ...e, inventory: inv, equipment: eq }], 'actors:equipment:equip');
    }
    unequipItem(actorId, key) {
        if (!key)
            return false;
        const list = this.getAll();
        const e = list.find((a) => a.id === actorId) ?? this.ensure(actorId);
        const eq = Array.isArray(e.equipment) ? e.equipment.slice() : [];
        const idx = eq.indexOf(key);
        if (idx < 0)
            return false;
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
