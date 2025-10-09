import type { CommonDeps, HostObject } from '../types';
import { HostReplicator, type PatchOp } from '../replicator';

export class HostListObject<T> implements HostObject {
  readonly id: string;
  protected readonly replicator: HostReplicator;
  private readonly path: string;
  private readonly max: number;

  constructor(protected deps: CommonDeps, id: string, options?: { path?: string; initial?: T[]; max?: number; context?: string }) {
    this.id = id;
    this.path = options?.path ?? 'entries';
    this.max = options?.max ?? 256;
    this.replicator = new HostReplicator((kind, body, context) => deps.publish(kind, body, context), 512, 64);
    const initial = Array.isArray(options?.initial) ? options.initial : [];
    const payload: Record<string, unknown> = { [this.path]: initial };
    this.replicator.set(this.id, payload, options?.context ?? 'list:init');
  }

  append(item: T, context = 'list:append') {
    const snapshot = this.replicator.get(this.id)?.value;
    const container = isRecord(snapshot) ? snapshot[this.path] : undefined;
    const list: T[] = Array.isArray(container) ? [...(container as T[])] : [];
    list.push(item);
    while (list.length > this.max) list.shift();
    // First change after init might be rev=1 already; replicator handles set/patch logging.
    if ((this.replicator.get(this.id)?.rev ?? 0) === 0) {
      const payload: Record<string, unknown> = { [this.path]: list };
      return this.replicator.set(this.id, payload, context);
    }
    const op: PatchOp = { op: 'insert', path: this.path, value: item };
    return this.replicator.apply(this.id, [op], context);
  }

  replaceAll(items: T[], context = 'list:replace') {
    const payload: Record<string, unknown> = { [this.path]: [...items] };
    return this.replicator.set(this.id, payload, context);
  }

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, `object-request ${this.id}`);
  }

  getSnapshot() { return this.replicator.get(this.id); }
  getLogsSince(sinceRev: number) { return this.replicator.getLogsSince(this.id, sinceRev); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
