import type { CommonDeps, HostObject } from '../types';
import { HostReplicator, type PatchOp } from '../replicator';

export class HostValueObject<T> implements HostObject {
  readonly id: string;
  protected readonly replicator: HostReplicator;
  constructor(protected deps: CommonDeps, id: string, initial?: T, context = 'value:init') {
    this.id = id;
    this.replicator = new HostReplicator((kind, body, ctx) => deps.publish(kind, body, ctx), 256, 64);
    if (initial !== undefined) {
      this.replicator.set(this.id, initial, context);
    }
  }

  set(value: T, context = 'value:set') {
    return this.replicator.set(this.id, value, context);
  }

  merge(partial: Partial<T>, context = 'value:merge') {
    const op: PatchOp = { op: 'merge', value: partial };
    return this.replicator.apply(this.id, [op], context);
  }

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, `object-request ${this.id}`);
  }

  getSnapshot() { return this.replicator.get(this.id); }
  getLogsSince(sinceRev: number) { return this.replicator.getLogsSince(this.id, sinceRev); }
}
