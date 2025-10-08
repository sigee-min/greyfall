import type { CommonDeps, HostObject } from '../types';
import { HostReplicator, type PatchOp } from '../replicator';

type WithId = { id: string };

export class HostKeyedListObject<T extends WithId> implements HostObject {
  readonly id: string;
  protected readonly replicator: HostReplicator;
  private readonly path: string;

  constructor(protected deps: CommonDeps, id: string, options?: { path?: string; initial?: T[]; context?: string }) {
    this.id = id;
    this.path = options?.path ?? 'list';
    this.replicator = new HostReplicator((kind, body, context) => deps.publish(kind, body, context), 512, 64);
    const initial = Array.isArray(options?.initial) ? options.initial : [];
    const payload: Record<string, unknown> = { [this.path]: initial };
    this.replicator.set(this.id, payload, options?.context ?? 'keyed-list:init');
  }

  upsertMany(entries: T[], context = 'keyed-list:upsert') {
    const op: PatchOp = { op: 'merge', path: this.path, value: entries };
    return this.replicator.apply(this.id, [op], context);
  }

  removeById(id: string, context = 'keyed-list:remove') {
    const op: PatchOp = { op: 'remove', path: this.path, value: { id } };
    return this.replicator.apply(this.id, [op], context);
  }

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, `object-request ${this.id}`);
  }

  getSnapshot() { return this.replicator.get(this.id); }
  getLogsSince(sinceRev: number) { return this.replicator.getLogsSince(this.id, sinceRev); }
}
