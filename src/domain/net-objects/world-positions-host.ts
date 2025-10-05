import type { HostObject, CommonDeps } from './types';
import { HostReplicator } from './replicator';
import { getMap, getEntryField, isNeighbor } from '../world/nav';

export const WORLD_POSITIONS_OBJECT_ID = 'world:positions';

export type PositionEntry = { id: string; mapId: string; fieldId: string };

export class HostWorldPositionsObject implements HostObject {
  readonly id = WORLD_POSITIONS_OBJECT_ID;
  private readonly replicator: HostReplicator;
  constructor(private deps: CommonDeps) {
    this.replicator = new HostReplicator((kind, body, ctx) => deps.publish(kind as any, body as any, ctx));
    // initialize empty
    this.replicator.set(this.id, { list: [] }, 'world:positions:init');
  }

  ensureParticipant(participantId: string, mapId: string) {
    const map = getMap(mapId) ?? getMap('LUMENFORD');
    if (!map) return false;
    const entry = getEntryField(map);
    if (!entry) return false;
    const base = this.replicator.get(this.id)?.value as any;
    const list: PositionEntry[] = Array.isArray(base?.list) ? base.list : [];
    const exists = list.find((e) => e.id === participantId);
    if (exists) return true;
    return this.replicator.apply(
      this.id,
      [{ op: 'merge', path: 'list', value: [{ id: participantId, mapId: map.id, fieldId: entry.id }] } as any],
      'world:positions:ensure'
    );
  }

  moveField(playerId: string, mapId: string, fromFieldId: string, toFieldId: string) {
    const map = getMap(mapId);
    if (!map) return false;
    if (!isNeighbor(map, fromFieldId, toFieldId)) return false;
    return this.replicator.apply(
      this.id,
      [{ op: 'merge', path: 'list', value: [{ id: playerId, mapId, fieldId: toFieldId }] } as any],
      'world:positions:move'
    );
  }

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, 'object-request world:positions');
  }
}

