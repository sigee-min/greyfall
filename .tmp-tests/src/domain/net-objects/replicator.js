export class HostReplicator {
    constructor(publish, maxLog = 128) {
        this.publish = publish;
        this.state = new Map();
        // Simple logs per id for future incremental patch (not used yet)
        this.logs = new Map();
        this.maxLog = maxLog;
    }
    get(id) {
        return this.state.get(id) ?? null;
    }
    set(id, value, context = 'replicator:set') {
        const current = this.state.get(id);
        const rev = (current?.rev ?? 0) + 1;
        this.state.set(id, { rev, value });
        this.appendLog(id, { rev, ops: [{ op: 'set', value }] });
        return this.publish('object:replace', { id, rev, value }, context);
    }
    apply(id, ops, context = 'replicator:apply') {
        const current = this.state.get(id) ?? { rev: 0, value: {} };
        const nextVal = this.applyOps(current.value, ops);
        const rev = current.rev + 1;
        this.state.set(id, { rev, value: nextVal });
        this.appendLog(id, { rev, ops });
        return this.publish('object:patch', { id, rev, ops: ops }, context);
    }
    onRequest(id, sinceRev, context = 'replicator:request') {
        const current = this.state.get(id);
        if (!current)
            return false;
        // For now always send replace; incremental patch can be added later
        return this.publish('object:replace', { id, rev: current.rev, value: current.value }, context);
    }
    appendLog(id, entry) {
        const list = this.logs.get(id) ?? [];
        list.push(entry);
        while (list.length > this.maxLog)
            list.shift();
        this.logs.set(id, list);
    }
    applyOps(base, ops) {
        let result = structuredClone(base);
        for (const op of ops) {
            if (op.op === 'set') {
                result = structuredClone(op.value);
            }
            else if (op.op === 'merge') {
                if (typeof result === 'object' && result) {
                    Object.assign(result, op.value);
                }
                else {
                    result = structuredClone(op.value);
                }
            }
            else if (op.op === 'insert') {
                const path = op.path;
                const value = op.value;
                if (path) {
                    const container = result[path];
                    if (Array.isArray(container)) {
                        if (Array.isArray(value))
                            container.push(...value);
                        else
                            container.push(value);
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
            else if (op.op === 'remove') {
                const path = op.path;
                const value = op.value;
                if (path) {
                    const container = result[path];
                    if (Array.isArray(container)) {
                        if (typeof value === 'number')
                            container.splice(value, 1);
                        else if (value && typeof value === 'object' && 'id' in value) {
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
