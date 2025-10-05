export class ClientNetObjectStore {
    constructor() {
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    get(id) {
        return this.state.get(id) ?? null;
    }
    applyReplace(id, rev, value) {
        const current = this.state.get(id);
        if (current && rev <= current.rev)
            return false; // stale
        this.state.set(id, { rev, value });
        return true;
    }
    applyPatch(id, rev, ops) {
        const current = this.state.get(id);
        if (!current)
            return false; // need base
        if (rev !== current.rev + 1)
            return false; // out-of-order; request replace
        const next = this.applyOps(structuredClone(current.value), ops);
        this.state.set(id, { rev, value: next });
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
                if (result && typeof result === 'object') {
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
