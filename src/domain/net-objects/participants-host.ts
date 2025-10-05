import { PARTICIPANTS_OBJECT_ID, makeParticipantsSnapshot } from './participants';
import type { CommonDeps, HostObject } from './types';
import { HostReplicator } from './replicator';

export class HostParticipantsObject implements HostObject {
  readonly id = PARTICIPANTS_OBJECT_ID;
  private readonly replicator: HostReplicator;
  constructor(private deps: CommonDeps) {
    this.replicator = new HostReplicator((kind, body, ctx) => deps.publish(kind as any, body as any, ctx));
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

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, 'object-request participants');
  }
}

