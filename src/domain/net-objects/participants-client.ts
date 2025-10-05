import type { ClientObject } from './types';
import type { LobbyStore } from '../session/session-store';
import { PARTICIPANTS_OBJECT_ID, isParticipantsSnapshot } from './participants.js';

export class ClientParticipantsObject implements ClientObject {
  readonly id = PARTICIPANTS_OBJECT_ID;
  constructor(private lobbyStore: LobbyStore) {}

  onReplace(_rev: number, value: unknown) {
    if (isParticipantsSnapshot(value)) {
      this.lobbyStore.replaceFromWire(value.list);
      return;
    }
    // Legacy/compat shapes
    const v: any = value as any;
    if (Array.isArray(v?.participants)) {
      this.lobbyStore.replaceFromWire(v.participants);
      return;
    }
    if (Array.isArray(v?.list)) {
      this.lobbyStore.replaceFromWire(v.list);
    }
  }

  onPatch(_rev: number, ops: unknown[]) {
    if (!Array.isArray(ops)) return;
    // We implement only shallow array merge/remove semantics for path 'list'
    const { lobbyStore } = this;
    const current = lobbyStore.snapshotWire();
    let next = current.slice();
    for (const raw of ops as any[]) {
      const kind = raw?.op;
      const path = raw?.path;
      const value = raw?.value;
      if (path !== 'list') continue;
      if (kind === 'merge') {
        const items = Array.isArray(value) ? value : [value];
        for (const patch of items) {
          const id = patch?.id;
          if (!id) continue;
          const idx = next.findIndex((e) => e.id === id);
          if (idx >= 0) next[idx] = { ...next[idx], ...patch } as any;
          else next.push(patch as any);
        }
      } else if (kind === 'remove') {
        if (typeof value === 'object' && value && 'id' in (value as any)) {
          const id = (value as any).id as string;
          next = next.filter((e) => e.id !== id);
        } else if (typeof value === 'number') {
          next.splice(value, 1);
        }
      } else if (kind === 'set') {
        const v: any = value as any;
        if (Array.isArray(v?.list)) next = v.list as any[];
      }
    }
    lobbyStore.replaceFromWire(next as any);
  }
}
