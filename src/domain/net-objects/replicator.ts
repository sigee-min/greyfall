import type { LobbyMessageBodies } from '../../protocol';

export type PatchOp = LobbyMessageBodies['object:patch']['ops'][number];

type ObjectState = { rev: number; value: unknown };

export type ReplicatorPublish = <K extends 'object:replace' | 'object:patch'>(
  kind: K,
  body: LobbyMessageBodies[K],
  context?: string
) => boolean;

export class HostReplicator {
  private state = new Map<string, ObjectState>();
  // Simple logs per id for future incremental patch (not used yet)
  private logs = new Map<string, { rev: number; ops: PatchOp[] }[]>();
  private readonly maxLog: number;
  private readonly maxDeltaBurst: number;
  constructor(private publish: ReplicatorPublish, maxLog = 128, maxDeltaBurst = 64) {
    this.maxLog = maxLog;
    this.maxDeltaBurst = maxDeltaBurst;
  }

  get(id: string) {
    return this.state.get(id) ?? null;
  }

  getLogsSince(id: string, sinceRev: number) {
    const list = this.logs.get(id) ?? [];
    return list.filter((e) => e.rev > sinceRev);
  }

  set(id: string, value: unknown, context = 'replicator:set') {
    const current = this.state.get(id);
    const rev = (current?.rev ?? 0) + 1;
    this.state.set(id, { rev, value });
    this.appendLog(id, { rev, ops: [{ op: 'set', value }] });
    return this.publish('object:replace', { id, rev, value }, context);
  }

  apply(id: string, ops: PatchOp[], context = 'replicator:apply') {
    const current = this.state.get(id) ?? { rev: 0, value: {} };
    const nextVal = this.applyOps(current.value, ops);
    const rev = current.rev + 1;
    this.state.set(id, { rev, value: nextVal });
    this.appendLog(id, { rev, ops: structuredClone(ops) });
    return this.publish('object:patch', { id, rev, ops }, context);
  }

  onRequest(id: string, sinceRev?: number, context = 'replicator:request') {
    const current = this.state.get(id);
    if (!current) return false;
    const sr = typeof sinceRev === 'number' ? sinceRev : undefined;
    if (sr != null && sr >= 0 && sr < current.rev) {
      const deltas = this.getLogsSince(id, sr);
      if (deltas.length > 0 && deltas.length <= this.maxDeltaBurst) {
        for (const entry of deltas) {
          this.publish('object:patch', { id, rev: entry.rev, ops: entry.ops }, `${context}:delta`);
        }
        return true;
      }
    }
    // Fallback to full snapshot
    return this.publish('object:replace', { id, rev: current.rev, value: current.value }, context);
  }

  private appendLog(id: string, entry: { rev: number; ops: PatchOp[] }) {
    const list = this.logs.get(id) ?? [];
    list.push(entry);
    while (list.length > this.maxLog) list.shift();
    this.logs.set(id, list);
  }

  private applyOps(base: unknown, ops: PatchOp[]) {
    let result: unknown = structuredClone(base);
    for (const op of ops) {
      switch (op.op) {
        case 'set':
          result = structuredClone(op.value);
          break;
        case 'merge':
          result = this.applyMerge(result, op.path, op.value);
          break;
        case 'insert':
          result = this.applyInsert(result, op.path, op.value);
          break;
        case 'remove':
          result = this.applyRemove(result, op.path, op.value);
          break;
        default:
          break;
      }
    }
    return result;
  }

  private applyMerge(base: unknown, path: string | undefined, value: unknown): unknown {
    if (!path) {
      if (isRecord(base) && isRecord(value)) {
        return { ...base, ...value };
      }
      return structuredClone(value);
    }

    if (!isRecord(base)) {
      return { [path]: structuredClone(value) };
    }

    const clone: Record<string, unknown> = { ...base };
    const current = clone[path];

    if (Array.isArray(current)) {
      const next = [...current];
      const values = Array.isArray(value) ? value : value != null ? [value] : [];
      for (const patch of values) {
        if (!isRecord(patch) || typeof patch.id !== 'string') {
          next.push(structuredClone(patch));
          continue;
        }
        const idx = next.findIndex((item) => isRecord(item) && item.id === patch.id);
        if (idx >= 0) {
          const existing = next[idx];
          next[idx] = isRecord(existing) ? { ...existing, ...patch } : structuredClone(patch);
        } else {
          next.push(structuredClone(patch));
        }
      }
      clone[path] = next;
      return clone;
    }

    if (isRecord(current) && isRecord(value)) {
      clone[path] = { ...current, ...value };
      return clone;
    }

    clone[path] = structuredClone(value);
    return clone;
  }

  private applyInsert(base: unknown, path: string | undefined, value: unknown): unknown {
    if (!path) {
      if (!Array.isArray(base)) return base;
      const next = [...base];
      this.pushNormalized(next, value);
      return next;
    }

    if (!isRecord(base)) {
      return { [path]: this.normalisedList(value) };
    }

    const clone: Record<string, unknown> = { ...base };
    const current = clone[path];
    if (Array.isArray(current)) {
      const next = [...current];
      this.pushNormalized(next, value);
      clone[path] = next;
    } else {
      clone[path] = this.normalisedList(value);
    }
    return clone;
  }

  private applyRemove(base: unknown, path: string | undefined, value: unknown): unknown {
    if (!path || !isRecord(base)) return base;

    const clone: Record<string, unknown> = { ...base };
    const current = clone[path];
    if (Array.isArray(current)) {
      const next = [...current];
      if (typeof value === 'number') {
        if (value >= 0 && value < next.length) next.splice(value, 1);
      } else if (isRecord(value) && typeof value.id === 'string') {
        const idx = next.findIndex((item) => isRecord(item) && item.id === value.id);
        if (idx >= 0) next.splice(idx, 1);
      }
      clone[path] = next;
    } else if (isRecord(current) && typeof value === 'string') {
      const next = { ...current };
      delete next[value];
      clone[path] = next;
    }
    return clone;
  }

  private pushNormalized(target: unknown[], value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        target.push(structuredClone(item));
      }
    } else if (value !== undefined) {
      target.push(structuredClone(value));
    }
  }

  private normalisedList(value: unknown): unknown[] {
    if (Array.isArray(value)) return value.map((item) => structuredClone(item));
    if (value === undefined) return [];
    return [structuredClone(value)];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
