import { HostReplicator } from './replicator';
import { getMap, getEntryField, isNeighbor } from '../world/nav';
import { registerNetObject, HostAckFallback } from './registry.js';
import { worldPositionsClient } from './world-positions-client.js';
export const WORLD_POSITIONS_OBJECT_ID = 'world:positions';
export class HostWorldPositionsObject {
    constructor(deps) {
        this.deps = deps;
        this.id = WORLD_POSITIONS_OBJECT_ID;
        this.replicator = new HostReplicator((kind, body, ctx) => deps.publish(kind, body, ctx));
        // initialize empty
        this.replicator.set(this.id, { list: [] }, 'world:positions:init');
    }
    ensureParticipant(participantId, mapId) {
        const map = getMap(mapId) ?? getMap('LUMENFORD');
        if (!map)
            return false;
        const entry = getEntryField(map);
        if (!entry)
            return false;
        const base = this.replicator.get(this.id)?.value;
        const list = Array.isArray(base?.list) ? base.list : [];
        const exists = list.find((e) => e.id === participantId);
        if (exists)
            return true;
        return this.replicator.apply(this.id, [{ op: 'merge', path: 'list', value: [{ id: participantId, mapId: map.id, fieldId: entry.id }] }], 'world:positions:ensure');
    }
    moveField(playerId, mapId, fromFieldId, toFieldId) {
        const map = getMap(mapId);
        if (!map)
            return false;
        if (!isNeighbor(map, fromFieldId, toFieldId))
            return false;
        return this.replicator.apply(this.id, [{ op: 'merge', path: 'list', value: [{ id: playerId, mapId, fieldId: toFieldId }] }], 'world:positions:move');
    }
    movePartyToMap(mapId, memberIds) {
        const map = getMap(mapId);
        if (!map)
            return false;
        const entry = getEntryField(map);
        if (!entry)
            return false;
        const ops = memberIds.map((id) => ({ id, mapId: map.id, fieldId: entry.id }));
        return this.replicator.apply(this.id, [{ op: 'merge', path: 'list', value: ops }], 'world:positions:party-travel');
    }
    onRequest(sinceRev) {
        return this.replicator.onRequest(this.id, sinceRev, 'object-request world:positions');
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
