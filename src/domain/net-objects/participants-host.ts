import { PARTICIPANTS_OBJECT_ID, makeParticipantsSnapshot } from './participants.js';
import type { CommonDeps, HostObject } from './types';
import { HostReplicator } from './replicator.js';

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

  // Patch helpers for more granular sync
  upsert(participant: { id: string; [k: string]: unknown }, context = 'participants:upsert') {
    const base = this.replicator.get(this.id);
    if (!base) return this.broadcast(context);
    return this.replicator.apply(this.id, [{ op: 'merge', path: 'list', value: [{ ...participant }] } as any], context);
  }

  update(participantId: string, changes: Record<string, unknown>, context = 'participants:update') {
    const base = this.replicator.get(this.id);
    if (!base) return this.broadcast(context);
    return this.replicator.apply(this.id, [{ op: 'merge', path: 'list', value: [{ id: participantId, ...changes }] } as any], context);
  }

  remove(participantId: string, context = 'participants:remove') {
    const base = this.replicator.get(this.id);
    if (!base) return this.broadcast(context);
    return this.replicator.apply(this.id, [{ op: 'remove', path: 'list', value: { id: participantId } } as any], context);
  }

  getSnapshot() {
    return this.replicator.get(this.id);
  }

  getLogsSince(sinceRev: number) {
    return this.replicator.getLogsSince(this.id, sinceRev);
  }
}
