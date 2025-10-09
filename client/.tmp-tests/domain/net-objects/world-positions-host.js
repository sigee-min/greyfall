import { HostKeyedListObject } from './base/keyed-list-object.js';
import { getMap, getEntryField, isNeighbor } from '../world/nav';
import { registerNetObject, HostAckFallback } from './registry.js';
import { worldPositionsClient } from './world-positions-client.js';
import { WORLD_POSITIONS_OBJECT_ID } from './object-ids.js';
export { WORLD_POSITIONS_OBJECT_ID } from './object-ids.js';
export class HostWorldPositionsObject {
    constructor(deps) {
        this.deps = deps;
        this.id = WORLD_POSITIONS_OBJECT_ID;
        this.list = new HostKeyedListObject(deps, this.id, { path: 'list', initial: [], context: 'world:positions:init' });
    }
    ensureParticipant(participantId, mapId) {
        const map = getMap(mapId) ?? getMap('LUMENFORD');
        if (!map)
            return false;
        const entry = getEntryField(map);
        if (!entry)
            return false;
        const snap = this.list.getSnapshot()?.value;
        const list = Array.isArray(snap?.list) ? snap.list : [];
        const exists = list.find((e) => e.id === participantId);
        if (exists)
            return true;
        return this.list.upsertMany([{ id: participantId, mapId: map.id, fieldId: entry.id }], 'world:positions:ensure');
    }
    moveField(playerId, mapId, fromFieldId, toFieldId) {
        const map = getMap(mapId);
        if (!map)
            return false;
        if (!isNeighbor(map, fromFieldId, toFieldId))
            return false;
        return this.list.upsertMany([{ id: playerId, mapId, fieldId: toFieldId }], 'world:positions:move');
    }
    movePartyToMap(mapId, memberIds) {
        const map = getMap(mapId);
        if (!map)
            return false;
        const entry = getEntryField(map);
        if (!entry)
            return false;
        const ops = memberIds.map((id) => ({ id, mapId: map.id, fieldId: entry.id }));
        return this.list.upsertMany(ops, 'world:positions:party-travel');
    }
    onRequest(sinceRev) {
        return this.list.onRequest(sinceRev);
    }
    getList() {
        const snap = this.list.getSnapshot()?.value;
        return Array.isArray(snap?.list) ? snap.list : [];
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
