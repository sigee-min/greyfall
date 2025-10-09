import type { HostObject, CommonDeps } from './types';
import { HostKeyedListObject } from './base/keyed-list-object.js';
import { getMap, getEntryField, isNeighbor } from '../world/nav';
import { registerNetObject, HostAckFallback } from './registry.js';
import { worldPositionsClient } from './world-positions-client.js';
import { WORLD_POSITIONS_OBJECT_ID } from './object-ids.js';
export { WORLD_POSITIONS_OBJECT_ID } from './object-ids.js';

export type PositionEntry = { id: string; mapId: string; fieldId: string };

export class HostWorldPositionsObject implements HostObject {
  readonly id = WORLD_POSITIONS_OBJECT_ID;
  private readonly list: HostKeyedListObject<PositionEntry>;
  constructor(private deps: CommonDeps) {
    this.list = new HostKeyedListObject<PositionEntry>(deps, this.id, { path: 'list', initial: [], context: 'world:positions:init' });
  }

  ensureParticipant(participantId: string, mapId: string) {
    const map = getMap(mapId) ?? getMap('LUMENFORD');
    if (!map) return false;
    const entry = getEntryField(map);
    if (!entry) return false;
    const snap = this.list.getSnapshot()?.value as any;
    const list: PositionEntry[] = Array.isArray(snap?.list) ? snap.list : [];
    const exists = list.find((e) => e.id === participantId);
    if (exists) return true;
    return this.list.upsertMany([{ id: participantId, mapId: map.id, fieldId: entry.id }], 'world:positions:ensure');
  }

  moveField(playerId: string, mapId: string, fromFieldId: string, toFieldId: string) {
    const map = getMap(mapId);
    if (!map) return false;
    if (!isNeighbor(map, fromFieldId, toFieldId)) return false;
    return this.list.upsertMany([{ id: playerId, mapId, fieldId: toFieldId }], 'world:positions:move');
  }

  movePartyToMap(mapId: string, memberIds: string[]) {
    const map = getMap(mapId);
    if (!map) return false;
    const entry = getEntryField(map);
    if (!entry) return false;
    const ops = memberIds.map((id) => ({ id, mapId: map.id, fieldId: entry.id }));
    return this.list.upsertMany(ops, 'world:positions:party-travel');
  }

  onRequest(sinceRev?: number) {
    return this.list.onRequest(sinceRev);
  }

  getList(): PositionEntry[] {
    const snap = this.list.getSnapshot()?.value as any;
    return Array.isArray(snap?.list) ? (snap.list as PositionEntry[]) : [];
  }
}

registerNetObject({
  id: WORLD_POSITIONS_OBJECT_ID,
  host: {
    create: (deps) => new HostWorldPositionsObject(deps),
    ack: {
      incrementalMax: 32,
      fallbackStrategy: HostAckFallback.Snapshot
    },
    onPeerConnect: (object) => {
      object.onRequest(undefined);
    }
  },
  client: {
    create: () => worldPositionsClient,
    requestOnStart: true,
    requestContext: 'request world positions'
  }
});
