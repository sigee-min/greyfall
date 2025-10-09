import { WORLD_ACTORS_OBJECT_ID } from './object-ids.js';
class ClientWorldActors {
    constructor() {
        this.id = WORLD_ACTORS_OBJECT_ID;
        this.list = [];
        this.subs = new Set();
    }
    onReplace(_rev, value) {
        const v = value;
        const list = Array.isArray(v?.list) ? v.list : [];
        this.list = list.map((raw) => normalizeEntry(raw));
        this.emit();
    }
    onPatch(_rev, ops) {
        const list = [...this.list];
        for (const op of ops ?? []) {
            if (op?.op === 'merge' && op.path === 'list') {
                const items = Array.isArray(op.value) ? op.value : [op.value];
                for (const p of items) {
                    const e = normalizeEntry(p);
                    const idx = list.findIndex((x) => x.id === e.id);
                    if (idx >= 0)
                        list[idx] = e;
                    else
                        list.push(e);
                }
            }
        }
        this.list = list;
        this.emit();
    }
    getAll() { return this.list.slice(); }
    getFor(id) { return this.list.find((e) => e.id === id) ?? null; }
    subscribe(cb) { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
    emit() { for (const s of this.subs)
        s(this.list.slice()); }
}
function normalizeEntry(raw) {
    const hp = raw?.hp && typeof raw.hp === 'object' ? { cur: Number(raw.hp.cur ?? 0), max: Number(raw.hp.max ?? 0) } : undefined;
    const inv = Array.isArray(raw?.inventory) ? raw.inventory.map((i) => ({ key: String(i?.key ?? ''), count: Math.max(0, Number(i?.count ?? 0)) })) : undefined;
    const eq = Array.isArray(raw?.equipment) ? raw.equipment.map((e) => String(e ?? '')) : undefined;
    const status = Array.isArray(raw?.status) ? raw.status.map((s) => String(s ?? '')).filter(Boolean) : undefined;
    return { id: String(raw?.id ?? ''), hp, inventory: inv, equipment: eq, status };
}
export const worldActorsClient = new ClientWorldActors();
export function getActorById(id) {
    return worldActorsClient.getFor(id);
}
export function getInventoryOf(id) { return getActorById(id)?.inventory ?? []; }
export function withPosition(list, positions) {
    const pos = new Map(positions.map((p) => [p.id, p]));
    return list.map((a) => ({ ...a, mapId: pos.get(a.id)?.mapId, fieldId: pos.get(a.id)?.fieldId }));
}
