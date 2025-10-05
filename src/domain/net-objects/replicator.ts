import type { LobbyMessageBodies } from '../../protocol';

type PatchOp = { op: 'set' | 'merge'; path?: string; value?: unknown };

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
  constructor(private publish: ReplicatorPublish, maxLog = 128) {
    this.maxLog = maxLog;
  }

  get(id: string) {
    return this.state.get(id) ?? null;
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
    this.appendLog(id, { rev, ops });
    return this.publish('object:patch', { id, rev, ops: ops as any }, context);
  }

  onRequest(id: string, sinceRev?: number, context = 'replicator:request') {
    const current = this.state.get(id);
    if (!current) return false;
    // For now always send replace; incremental patch can be added later
    return this.publish('object:replace', { id, rev: current.rev, value: current.value }, context);
  }

  private appendLog(id: string, entry: { rev: number; ops: PatchOp[] }) {
    const list = this.logs.get(id) ?? [];
    list.push(entry);
    while (list.length > this.maxLog) list.shift();
    this.logs.set(id, list);
  }

  private applyOps(base: unknown, ops: PatchOp[]) {
    let result = structuredClone(base) as any;
    for (const op of ops) {
      if (op.op === 'set') {
        result = structuredClone(op.value) as any;
      } else if (op.op === 'merge') {
        if (typeof result === 'object' && result) {
          Object.assign(result, op.value as any);
        } else {
          result = structuredClone(op.value) as any;
        }
      } else if ((op as any).op === 'insert') {
        const path = (op as any).path as string | undefined;
        const value = (op as any).value as unknown;
        if (path) {
          const container = (result as any)[path];
          if (Array.isArray(container)) {
            if (Array.isArray(value)) container.push(...value);
            else container.push(value);
          } else if (container == null) {
            (result as any)[path] = Array.isArray(value) ? [...value] : [value];
          }
        } else if (Array.isArray(result)) {
          if (Array.isArray(value)) (result as any).push(...value);
          else (result as any).push(value);
        }
      } else if ((op as any).op === 'remove') {
        const path = (op as any).path as string | undefined;
        const value = (op as any).value as unknown;
        if (path) {
          const container = (result as any)[path];
          if (Array.isArray(container)) {
            if (typeof value === 'number') container.splice(value, 1);
            else if (value && typeof value === 'object' && 'id' in (value as any)) {
              const idx = container.findIndex((e: any) => e?.id === (value as any).id);
              if (idx >= 0) container.splice(idx, 1);
            }
          } else if (container && typeof container === 'object' && typeof value === 'string') {
            delete (container as any)[value];
          }
        }
      }
    }
    return result;
  }
}
