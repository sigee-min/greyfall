import type { ClientObject } from './types';

export const WORLD_POSITIONS_OBJECT_ID = 'world:positions';

export type PositionEntry = { id: string; mapId: string; fieldId: string };

type Listener = (list: PositionEntry[]) => void;

class ClientWorldPositions implements ClientObject {
  id = WORLD_POSITIONS_OBJECT_ID;
  private list: PositionEntry[] = [];
  private listeners = new Set<Listener>();

  onReplace(_rev: number, value: unknown) {
    const v = value as any;
    const list = Array.isArray(v?.list) ? (v.list as any[]) : [];
    this.list = list.map((e) => ({ id: String(e.id), mapId: String(e.mapId), fieldId: String(e.fieldId) }));
    this.emit();
  }

  onPatch(_rev: number, ops: unknown[]) {
    const list = [...this.list];
    for (const op of ops as any[]) {
      if (op?.op === 'merge' && op.path === 'list') {
        const items = Array.isArray(op.value) ? op.value : [op.value];
        for (const p of items) {
          const idx = list.findIndex((e) => e.id === String(p.id));
          if (idx >= 0) list[idx] = { id: String(p.id), mapId: String(p.mapId), fieldId: String(p.fieldId) };
          else list.push({ id: String(p.id), mapId: String(p.mapId), fieldId: String(p.fieldId) });
        }
      }
    }
    this.list = list;
    this.emit();
  }

  getAll() {
    return this.list;
  }

  getFor(id: string) {
    return this.list.find((e) => e.id === id) ?? null;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn(this.list);
  }
}

export const worldPositionsClient = new ClientWorldPositions();
