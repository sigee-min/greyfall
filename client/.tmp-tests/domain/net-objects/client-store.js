import { patchOpSchema } from './schemas.js';
import { getPatchQueuePolicy } from './policies.js';
import { netBus } from '../../bus/net-bus.js';
export class ClientNetObjectStore {
    constructor(opts) {
        this.state = new Map();
        this.pending = new Map();
        this.timers = new Map();
        this.onStalled = opts?.onStalled;
    }
    get(id) {
        return this.state.get(id) ?? null;
    }
    applyReplace(id, rev, value) {
        const current = this.state.get(id);
        if (current && rev <= current.rev)
            return false; // stale
        this.state.set(id, { rev, value });
        // replace resolves stalls; clear any queued timer if queue drained
        const q0 = this.pending.get(id);
        if (!q0 || q0.size === 0)
            this.clearTimer(id);
        // After replace, try to apply any queued patches sequentially
        const queued = this.pending.get(id);
        if (queued) {
            let next = rev + 1;
            while (queued.has(next)) {
                const ops = queued.get(next);
                const ok = this.applyPatch(id, next, ops);
                queued.delete(next);
                if (ok !== 'applied')
                    break;
                next++;
            }
            if (queued.size === 0)
                this.pending.delete(id);
        }
        return true;
    }
    /**
     * Apply a patch for a given object id/rev.
     * Returns:
     *  - 'applied' when the patch was applied immediately to current state
     *  - 'queued' when the patch targets a future rev and was enqueued awaiting missing revs
     *  - 'rejected' when the patch could not be validated or base snapshot is missing
     */
    applyPatch(id, rev, ops) {
        // Validate ops shape early; reject invalid payloads
        if (!Array.isArray(ops) || ops.some((op) => !patchOpSchema.safeParse(op).success)) {
            return 'rejected';
        }
        const current = this.state.get(id);
        if (!current)
            return 'rejected'; // need base snapshot first
        if (rev > current.rev + 1) {
            // future patch: queue and wait for missing revs
            const bucket = this.pending.get(id) ?? new Map();
            bucket.set(rev, ops);
            this.pending.set(id, bucket);
            try {
                netBus.publish('client:patch:queued', { objectId: id, rev, queuedCount: bucket.size });
            }
            catch { }
            // If queue grows too large, request snapshot and clear queue
            const pq = getPatchQueuePolicy();
            if (bucket.size > pq.maxQueuedRevs) {
                // Clear queue and trigger stalled handler immediately
                this.pending.delete(id);
                this.clearTimer(id);
                const s = this.state.get(id);
                const sinceRev = s?.rev;
                try {
                    netBus.publish('client:patch:stalled', { objectId: id, sinceRev: typeof sinceRev === 'number' ? sinceRev : undefined });
                }
                catch { }
                try {
                    this.onStalled?.(id, typeof sinceRev === 'number' ? sinceRev : undefined);
                }
                catch { }
                return 'queued';
            }
            this.ensureTimer(id);
            return 'queued';
        }
        if (rev <= current.rev) {
            // duplicate or old patch — ignore
            try {
                netBus.publish('client:patch:applied', { objectId: id, rev: current.rev });
            }
            catch { }
            return 'applied';
        }
        const next = this.applyOps(structuredClone(current.value), ops);
        this.state.set(id, { rev, value: next });
        try {
            netBus.publish('client:patch:applied', { objectId: id, rev });
        }
        catch { }
        // drain any contiguous queued patches
        const queued = this.pending.get(id);
        if (queued) {
            let nextRev = rev + 1;
            while (queued.has(nextRev)) {
                const qops = queued.get(nextRev);
                const applied = this.applyPatch(id, nextRev, qops);
                queued.delete(nextRev);
                if (applied !== 'applied')
                    break;
                nextRev++;
            }
            if (queued.size === 0) {
                this.pending.delete(id);
                this.clearTimer(id);
            }
            else {
                // still holes — keep timer
                this.ensureTimer(id);
            }
        }
        return 'applied';
    }
    dispose() {
        for (const t of this.timers.values()) {
            try {
                clearTimeout(t);
            }
            catch { }
        }
        this.timers.clear();
    }
    ensureTimer(id) {
        if (this.timers.has(id))
            return;
        const delay = getPatchQueuePolicy().timeoutMs;
        const timer = setTimeout(() => {
            this.timers.delete(id);
            const s = this.state.get(id);
            const sinceRev = s?.rev;
            try {
                netBus.publish('client:patch:stalled', { objectId: id, sinceRev: typeof sinceRev === 'number' ? sinceRev : undefined });
            }
            catch { }
            try {
                this.onStalled?.(id, typeof sinceRev === 'number' ? sinceRev : undefined);
            }
            catch { }
        }, Math.max(500, delay));
        this.timers.set(id, timer);
    }
    clearTimer(id) {
        const t = this.timers.get(id);
        if (t) {
            try {
                clearTimeout(t);
            }
            catch { }
            this.timers.delete(id);
        }
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
