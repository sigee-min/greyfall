import { patchOpSchema } from './schemas.js';
export class ClientNetObjectStore {
    constructor() {
        this.state = new Map();
        this.pending = new Map();
    }
    get(id) {
        return this.state.get(id) ?? null;
    }
    applyReplace(id, rev, value) {
        const current = this.state.get(id);
        if (current && rev <= current.rev)
            return false; // stale
        this.state.set(id, { rev, value });
        // After replace, try to apply any queued patches sequentially
        const queued = this.pending.get(id);
        if (queued) {
            let next = rev + 1;
            while (queued.has(next)) {
                const ops = queued.get(next);
                const ok = this.applyPatch(id, next, ops);
                queued.delete(next);
                if (!ok)
                    break;
                next++;
            }
            if (queued.size === 0)
                this.pending.delete(id);
        }
        return true;
    }
    applyPatch(id, rev, ops) {
        // Validate ops shape early; reject invalid payloads
        if (!Array.isArray(ops) || ops.some((op) => !patchOpSchema.safeParse(op).success)) {
            return false;
        }
        const current = this.state.get(id);
        if (!current)
            return false; // need base snapshot first
        if (rev > current.rev + 1) {
            // future patch: queue and wait for missing revs
            const bucket = this.pending.get(id) ?? new Map();
            bucket.set(rev, ops);
            this.pending.set(id, bucket);
            return true;
        }
        if (rev <= current.rev) {
            // duplicate or old patch — ignore
            return true;
        }
        const next = this.applyOps(structuredClone(current.value), ops);
        this.state.set(id, { rev, value: next });
        // drain any contiguous queued patches
        const queued = this.pending.get(id);
        if (queued) {
            let nextRev = rev + 1;
            while (queued.has(nextRev)) {
                const qops = queued.get(nextRev);
                const applied = this.applyPatch(id, nextRev, qops);
                queued.delete(nextRev);
                if (!applied)
                    break;
                nextRev++;
            }
            if (queued.size === 0)
                this.pending.delete(id);
        }
        return true;
    }
    applyOps(base, ops) {
        let result = base;
        for (const op of ops) {
            const kind = op?.op;
            const path = op?.path;
            const value = op?.value;
            if (kind === 'set') {
                result = structuredClone(value);
            }
            else if (kind === 'merge') {
                if (path) {
                    const target = result[path];
                    if (Array.isArray(target)) {
                        const items = Array.isArray(value) ? value : [value];
                        for (const patch of items) {
                            const id = patch?.id;
                            if (id == null)
                                continue;
                            const idx = target.findIndex((e) => e?.id === id);
                            if (idx >= 0) {
                                target[idx] = { ...target[idx], ...patch };
                            }
                            else {
                                target.push(patch);
                            }
                        }
                    }
                    else if (target && typeof target === 'object') {
                        Object.assign(target, value ?? {});
                    }
                    else {
                        result[path] = structuredClone(value ?? {});
                    }
                }
                else if (result && typeof result === 'object') {
                    Object.assign(result, value ?? {});
                }
                else {
                    result = structuredClone(value ?? {});
                }
            }
            else if (kind === 'insert') {
                if (path) {
                    // shallow path only (e.g., 'entries')
                    const container = result[path];
                    if (Array.isArray(container)) {
                        if (Array.isArray(value)) {
                            container.push(...value);
                        }
                        else {
                            container.push(value);
                        }
                    }
                    else if (container == null) {
                        result[path] = Array.isArray(value) ? [...value] : [value];
                    }
                }
                else if (Array.isArray(result)) {
                    if (Array.isArray(value))
                        result.push(...value);
                    else
                        result.push(value);
                }
            }
            else if (kind === 'remove') {
                if (path) {
                    const container = result[path];
                    if (Array.isArray(container)) {
                        if (typeof value === 'number') {
                            container.splice(value, 1);
                        }
                        else if (typeof value === 'object' && value && 'id' in value) {
                            const idx = container.findIndex((e) => e?.id === value.id);
                            if (idx >= 0)
                                container.splice(idx, 1);
                        }
                    }
                    else if (container && typeof container === 'object' && typeof value === 'string') {
                        delete container[value];
                    }
                }
            }
        }
        return result;
    }
}
