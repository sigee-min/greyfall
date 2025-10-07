import type { CommonDeps, HostObject } from '../types';
import { HostReplicator } from '../replicator';

export class HostValueObject<T extends unknown> implements HostObject {
  readonly id: string;
  protected readonly replicator: HostReplicator;
  constructor(protected deps: CommonDeps, id: string, initial?: T, context = 'value:init') {
    this.id = id;
    this.replicator = new HostReplicator((k, b, c) => deps.publish(k as any, b as any, c), 256, 64);
    if (initial !== undefined) {
      this.replicator.set(this.id, initial as unknown, context);
    }
  }

  set(value: T, context = 'value:set') {
    return this.replicator.set(this.id, value as unknown, context);
  }

  merge(partial: Partial<T>, context = 'value:merge') {
    return this.replicator.apply(this.id, [{ op: 'merge', value: partial as unknown }] as any, context);
  }

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, `object-request ${this.id}`);
  }

  getSnapshot() { return this.replicator.get(this.id); }
  getLogsSince(sinceRev: number) { return this.replicator.getLogsSince(this.id, sinceRev); }
}

