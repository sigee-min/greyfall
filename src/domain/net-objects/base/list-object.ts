import type { CommonDeps, HostObject } from '../types';
import { HostReplicator } from '../replicator';

export class HostListObject<T extends unknown> implements HostObject {
  readonly id: string;
  protected readonly replicator: HostReplicator;
  private readonly path: string;
  private readonly max: number;

  constructor(protected deps: CommonDeps, id: string, options?: { path?: string; initial?: T[]; max?: number; context?: string }) {
    this.id = id;
    this.path = options?.path ?? 'entries';
    this.max = options?.max ?? 256;
    this.replicator = new HostReplicator((k, b, c) => deps.publish(k as any, b as any, c), 512, 64);
    const initial = Array.isArray(options?.initial) ? options!.initial! : [];
    this.replicator.set(this.id, { [this.path]: initial } as any, options?.context ?? 'list:init');
  }

  append(item: T, context = 'list:append') {
    const snap = (this.replicator.get(this.id)?.value as any) ?? { [this.path]: [] };
    const list: T[] = Array.isArray(snap[this.path]) ? [...snap[this.path]] : [];
    list.push(item);
    while (list.length > this.max) list.shift();
    // First change after init might be rev=1 already; replicator handles set/patch logging.
    if ((this.replicator.get(this.id)?.rev ?? 0) === 0) {
      return this.replicator.set(this.id, { [this.path]: list } as any, context);
    }
    return this.replicator.apply(this.id, [{ op: 'insert', path: this.path, value: item }] as any, context);
  }

  replaceAll(items: T[], context = 'list:replace') {
    return this.replicator.set(this.id, { [this.path]: [...items] } as any, context);
  }

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, `object-request ${this.id}`);
  }

  getSnapshot() { return this.replicator.get(this.id); }
  getLogsSince(sinceRev: number) { return this.replicator.getLogsSince(this.id, sinceRev); }
}

