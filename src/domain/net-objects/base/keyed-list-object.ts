import type { CommonDeps, HostObject } from '../types';
import { HostReplicator } from '../replicator';

type WithId = { id: string };

export class HostKeyedListObject<T extends WithId> implements HostObject {
  readonly id: string;
  protected readonly replicator: HostReplicator;
  private readonly path: string;

  constructor(protected deps: CommonDeps, id: string, options?: { path?: string; initial?: T[]; context?: string }) {
    this.id = id;
    this.path = options?.path ?? 'list';
    this.replicator = new HostReplicator((k, b, c) => deps.publish(k as any, b as any, c), 512, 64);
    const initial = Array.isArray(options?.initial) ? options!.initial! : [];
    this.replicator.set(this.id, { [this.path]: initial } as any, options?.context ?? 'keyed-list:init');
  }

  upsertMany(entries: T[], context = 'keyed-list:upsert') {
    return this.replicator.apply(this.id, [{ op: 'merge', path: this.path, value: entries }] as any, context);
  }

  removeById(id: string, context = 'keyed-list:remove') {
    return this.replicator.apply(this.id, [{ op: 'remove', path: this.path, value: { id } } as any], context);
  }

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, `object-request ${this.id}`);
  }

  getSnapshot() { return this.replicator.get(this.id); }
  getLogsSince(sinceRev: number) { return this.replicator.getLogsSince(this.id, sinceRev); }
}

