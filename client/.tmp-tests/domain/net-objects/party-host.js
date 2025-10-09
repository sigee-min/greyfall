import { HostValueObject } from './base/value-object.js';
import { getMap } from '../world/nav';
import { PARTY_OBJECT_ID, WORLD_POSITIONS_OBJECT_ID } from './object-ids.js';
import { registerNetObject, HostAckFallback } from './registry.js';
export { PARTY_OBJECT_ID } from './object-ids.js';
export class HostPartyObject {
    constructor(deps, world) {
        this.deps = deps;
        this.world = world;
        this.id = PARTY_OBJECT_ID;
        this.value = new HostValueObject(deps, this.id, { mapId: 'LUMENFORD', members: [] }, 'party:init');
    }
    onRequest(sinceRev) {
        return this.value.onRequest(sinceRev);
    }
    addMember(id) {
        const base = this.value.getSnapshot()?.value;
        const members = Array.isArray(base?.members) ? base.members : [];
        if (members.includes(id))
            return true;
        return this.value.merge({ members: [...members, id] }, 'party:join');
    }
    removeMember(id) {
        const base = this.value.getSnapshot()?.value;
        const members = Array.isArray(base?.members) ? base.members : [];
        if (!members.includes(id))
            return true;
        const filtered = members.filter((m) => m !== id);
        return this.value.set({ mapId: base?.mapId ?? 'LUMENFORD', members: filtered }, 'party:leave');
    }
    getMapId() {
        const base = this.value.getSnapshot()?.value;
        return String(base?.mapId ?? 'LUMENFORD');
    }
    getMembers() {
        const base = this.value.getSnapshot()?.value;
        const members = Array.isArray(base?.members) ? base.members : [];
        return members;
    }
    travel(direction, toMapId) {
        const base = this.value.getSnapshot()?.value;
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
        return this.value.merge({ mapId: targetId }, 'party:travel');
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
