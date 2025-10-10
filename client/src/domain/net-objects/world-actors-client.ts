import type { ClientObject } from './types';
import { WORLD_ACTORS_OBJECT_ID } from './object-ids.js';
import type { PositionEntry } from './world-positions-client';
import type { Modifiers, SetsProgress } from '../equipment/effect-types';
import type { StatKey } from '../stats/keys';

export type ActorInventoryItem = { key: string; count: number };
export type ActorEntry = {
  id: string; // participant id
  hp?: { cur: number; max: number };
  status?: string[];
  inventory?: ActorInventoryItem[];
  equipment?: string[];
  // Optional equipment snapshot fields (tolerant parsing)
  modifiers?: Modifiers;
  derived?: Partial<Record<StatKey, number>>;
  effectsHash?: string;
  schemaVersion?: number;
  setsProgress?: SetsProgress[];
};

type Subscriber = (list: ActorEntry[]) => void;

class ClientWorldActors implements ClientObject {
  id = WORLD_ACTORS_OBJECT_ID;
  private list: ActorEntry[] = [];
  private subs = new Set<Subscriber>();

  onReplace(_rev: number, value: unknown) {
    const v = value as any;
    const list = Array.isArray(v?.list) ? v.list : [];
    this.list = list.map((raw: any) => normalizeEntry(raw));
    this.emit();
  }

  onPatch(_rev: number, ops: unknown[]) {
    const list = [...this.list];
    for (const op of (ops as any[]) ?? []) {
      if (op?.op === 'merge' && op.path === 'list') {
        const items = Array.isArray(op.value) ? op.value : [op.value];
        for (const p of items) {
          const e = normalizeEntry(p);
          const idx = list.findIndex((x) => x.id === e.id);
          if (idx >= 0) list[idx] = e; else list.push(e);
        }
      }
    }
    this.list = list;
    this.emit();
  }

  getAll() { return this.list.slice(); }
  getFor(id: string) { return this.list.find((e) => e.id === id) ?? null; }
  subscribe(cb: Subscriber) { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
  private emit() { for (const s of this.subs) s(this.list.slice()); }
}

function normalizeEntry(raw: any): ActorEntry {
  const hp = raw?.hp && typeof raw.hp === 'object' ? { cur: Number(raw.hp.cur ?? 0), max: Number(raw.hp.max ?? 0) } : undefined;
  const inv = Array.isArray(raw?.inventory) ? raw.inventory.map((i: any) => ({ key: String(i?.key ?? ''), count: Math.max(0, Number(i?.count ?? 0)) })) : undefined;
  const eq = Array.isArray(raw?.equipment) ? raw.equipment.map((e: any) => String(e ?? '')) : undefined;
  const status = Array.isArray(raw?.status) ? raw.status.map((s: any) => String(s ?? '')).filter(Boolean) : undefined;
  const modifiers = raw?.modifiers && typeof raw.modifiers === 'object' ? (raw.modifiers as Modifiers) : undefined;
  const derived = raw?.derived && typeof raw.derived === 'object' ? (raw.derived as Partial<Record<StatKey, number>>) : undefined;
  const effectsHash = typeof raw?.effectsHash === 'string' ? raw.effectsHash : undefined;
  const schemaVersion = typeof raw?.schemaVersion === 'number' ? raw.schemaVersion : undefined;
  const setsProgress = Array.isArray(raw?.setsProgress) ? (raw.setsProgress as SetsProgress[]) : undefined;
  return { id: String(raw?.id ?? ''), hp, inventory: inv, equipment: eq, status, modifiers, derived, effectsHash, schemaVersion, setsProgress };
}

export const worldActorsClient = new ClientWorldActors();

export function getActorById(id: string): ActorEntry | null {
  return worldActorsClient.getFor(id);
}

export function getInventoryOf(id: string): ActorInventoryItem[] { return getActorById(id)?.inventory ?? []; }

export function withPosition(list: ActorEntry[], positions: PositionEntry[]): Array<ActorEntry & { mapId?: string; fieldId?: string }> {
  const pos = new Map(positions.map((p) => [p.id, p]));
  return list.map((a) => ({ ...a, mapId: pos.get(a.id)?.mapId, fieldId: pos.get(a.id)?.fieldId }));
}
