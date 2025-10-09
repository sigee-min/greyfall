import { WORLD_POSITIONS_OBJECT_ID } from './object-ids.js';
class ClientWorldPositions {
    constructor() {
        this.id = WORLD_POSITIONS_OBJECT_ID;
        this.list = [];
        this.listeners = new Set();
    }
    onReplace(_rev, value) {
        const v = value;
        const list = Array.isArray(v?.list) ? v.list : [];
        this.list = list.map((e) => ({ id: String(e.id), mapId: String(e.mapId), fieldId: String(e.fieldId) }));
        this.emit();
    }
    onPatch(_rev, ops) {
        const list = [...this.list];
        for (const op of ops) {
            if (op?.op === 'merge' && op.path === 'list') {
                const items = Array.isArray(op.value) ? op.value : [op.value];
                for (const p of items) {
                    const idx = list.findIndex((e) => e.id === String(p.id));
                    if (idx >= 0)
                        list[idx] = { id: String(p.id), mapId: String(p.mapId), fieldId: String(p.fieldId) };
                    else
                        list.push({ id: String(p.id), mapId: String(p.mapId), fieldId: String(p.fieldId) });
                }
            }
        }
        this.list = list;
        this.emit();
    }
    getAll() {
        return this.list;
    }
    getFor(id) {
        return this.list.find((e) => e.id === id) ?? null;
    }
    subscribe(fn) {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }
    emit() {
        for (const fn of this.listeners)
            fn(this.list);
    }
}
export const worldPositionsClient = new ClientWorldPositions();
