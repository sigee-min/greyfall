export class InMemoryToolsHost {
    constructor(registry, baseCtx) {
        this.registry = registry;
        this.baseCtx = baseCtx;
        this.cache = new Map();
    }
    async invoke(id, input, opts) {
        const tool = this.registry.get(id);
        if (!tool)
            return { ok: false, error: `unknown-tool:${id}` };
        const key = opts?.cacheKey ? `${id}:${opts.cacheKey}` : null;
        if (key && this.cache.has(key)) {
            const entry = this.cache.get(key);
            if (Date.now() < entry.expiresAt)
                return entry.result;
            this.cache.delete(key);
        }
        try {
            if (tool.inputGuard) {
                const guard = tool.inputGuard;
                guard(input);
            }
            const result = await tool.invoke(this.baseCtx, input);
            if (result.ok && tool.outputGuard) {
                const guard = tool.outputGuard;
                guard(result.data);
            }
            if (key && opts?.ttlMs)
                this.cache.set(key, { expiresAt: Date.now() + Math.max(100, opts.ttlMs), result });
            return result;
        }
        catch (err) {
            return { ok: false, error: describeError(err) };
        }
    }
}
function describeError(err) {
    if (err instanceof Error)
        return err.message;
    return String(err);
}
