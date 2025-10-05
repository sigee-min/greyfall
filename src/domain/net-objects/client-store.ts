type ObjectState = { rev: number; value: unknown };

export class ClientNetObjectStore {
  private state = new Map<string, ObjectState>();

  get(id: string) {
    return this.state.get(id) ?? null;
  }

  applyReplace(id: string, rev: number, value: unknown): boolean {
    const current = this.state.get(id);
    if (current && rev <= current.rev) return false; // stale
    this.state.set(id, { rev, value });
    return true;
  }

  applyPatch(id: string, rev: number, ops: any[]): boolean {
    const current = this.state.get(id);
    if (!current) return false; // need base
    if (rev !== current.rev + 1) return false; // out-of-order; request replace

    const next = this.applyOps(structuredClone(current.value), ops);
    this.state.set(id, { rev, value: next });
    return true;
  }

  private applyOps(base: any, ops: any[]) {
    let result = base;
    for (const op of ops) {
      const kind = op?.op;
      const path = op?.path as string | undefined;
      const value = op?.value;
      if (kind === 'set') {
        result = structuredClone(value);
      } else if (kind === 'merge') {
        if (path) {
          const target = (result as any)[path];
          if (Array.isArray(target)) {
            const items = Array.isArray(value) ? value : [value];
            for (const patch of items) {
              const id = (patch as any)?.id;
              if (id == null) continue;
              const idx = target.findIndex((e: any) => e?.id === id);
              if (idx >= 0) {
                target[idx] = { ...target[idx], ...patch };
              } else {
                target.push(patch);
              }
            }
          } else if (target && typeof target === 'object') {
            Object.assign(target, value ?? {});
          } else {
            (result as any)[path] = structuredClone(value ?? {});
          }
        } else if (result && typeof result === 'object') {
          Object.assign(result, value ?? {});
        } else {
          result = structuredClone(value ?? {});
        }
      } else if (kind === 'insert') {
        if (path) {
          // shallow path only (e.g., 'entries')
          const container = (result as any)[path];
          if (Array.isArray(container)) {
            if (Array.isArray(value)) {
              container.push(...value);
            } else {
              container.push(value);
            }
          } else if (container == null) {
            (result as any)[path] = Array.isArray(value) ? [...value] : [value];
          }
        } else if (Array.isArray(result)) {
          if (Array.isArray(value)) result.push(...value);
          else result.push(value);
        }
      } else if (kind === 'remove') {
        if (path) {
          const container = (result as any)[path];
          if (Array.isArray(container)) {
            if (typeof value === 'number') {
              container.splice(value, 1);
            } else if (typeof value === 'object' && value && 'id' in (value as any)) {
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
