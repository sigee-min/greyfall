import { HostReplicator } from './replicator';
import { getMap } from '../world/nav';
import { WORLD_POSITIONS_OBJECT_ID } from './world-positions-host';
import { registerNetObject, HostAckFallback } from './registry.js';
export const PARTY_OBJECT_ID = 'party';
export class HostPartyObject {
    constructor(deps, world) {
        this.deps = deps;
        this.world = world;
        this.id = PARTY_OBJECT_ID;
        this.replicator = new HostReplicator((kind, body, ctx) => deps.publish(kind, body, ctx));
        // initialize with default map and empty members
        this.replicator.set(this.id, { mapId: 'LUMENFORD', members: [] }, 'party:init');
    }
    onRequest(sinceRev) {
        return this.replicator.onRequest(this.id, sinceRev, 'object-request party');
    }
    addMember(id) {
        const base = this.replicator.get(this.id)?.value;
        const members = Array.isArray(base?.members) ? base.members : [];
        if (members.includes(id))
            return true;
        return this.replicator.apply(this.id, [{ op: 'merge', path: 'members', value: [id] }], 'party:join');
    }
    removeMember(id) {
        const base = this.replicator.get(this.id)?.value;
        const members = Array.isArray(base?.members) ? base.members : [];
        if (!members.includes(id))
            return true;
        const filtered = members.filter((m) => m !== id);
        return this.replicator.set(this.id, { mapId: base?.mapId ?? 'LUMENFORD', members: filtered }, 'party:leave');
    }
    getMapId() {
        const base = this.replicator.get(this.id)?.value;
        return String(base?.mapId ?? 'LUMENFORD');
    }
    getMembers() {
        const base = this.replicator.get(this.id)?.value;
        const members = Array.isArray(base?.members) ? base.members : [];
        return members;
    }
    travel(direction, toMapId) {
        const base = this.replicator.get(this.id)?.value;
        const currentId = String(base?.mapId ?? 'LUMENFORD');
        let targetId = toMapId ?? currentId;
        if (direction) {
            const m = getMap(currentId);
            if (!m)
                return false;
            targetId = direction === 'next' ? (m.next ?? currentId) : (m.prev ?? currentId);
        }
        if (targetId === currentId)
            return true;
        const members = this.getMembers();
        const ok = this.world.movePartyToMap(targetId, members);
        if (!ok)
            return false;
        return this.replicator.apply(this.id, [{ op: 'merge', value: { mapId: targetId } }], 'party:travel');
    }
}
registerNetObject({
    id: PARTY_OBJECT_ID,
    host: {
        create: (deps, ctx) => {
            const world = ctx.get(WORLD_POSITIONS_OBJECT_ID);
            if (!world) {
                throw new Error('HostPartyObject requires world positions object');
            }
            return new HostPartyObject(deps, world);
        },
        ack: {
            incrementalMax: 16,
            fallbackStrategy: HostAckFallback.Snapshot
        },
        onPeerConnect: (object) => {
            object.onRequest(undefined);
        }
    },
    client: {
        requestOnStart: true,
        requestContext: 'request party'
    }
});
