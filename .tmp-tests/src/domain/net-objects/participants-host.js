import { PARTICIPANTS_OBJECT_ID, makeParticipantsSnapshot } from './participants';
import { HostReplicator } from './replicator';
export class HostParticipantsObject {
    constructor(deps) {
        this.deps = deps;
        this.id = PARTICIPANTS_OBJECT_ID;
        this.replicator = new HostReplicator((kind, body, ctx) => deps.publish(kind, body, ctx));
    }
    broadcast(context = 'participants-sync') {
        const { lobbyStore } = this.deps;
        const value = makeParticipantsSnapshot(lobbyStore.snapshotWire(), 4);
        return this.replicator.set(this.id, value, context);
    }
    onHello() {
        // hello 처리 후 스냅샷 브로드캐스트
        this.broadcast('hello');
    }
    onReady() {
        this.broadcast('ready-update');
    }
    onLeave() {
        this.broadcast('leave-relay');
    }
    onRequest(sinceRev) {
        return this.replicator.onRequest(this.id, sinceRev, 'object-request participants');
    }
}
