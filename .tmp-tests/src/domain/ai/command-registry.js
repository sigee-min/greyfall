class Registry {
    constructor() {
        this.specs = new Map();
        this.lastExecAt = new Map();
        this.executedIds = new Set();
    }
    register(spec) {
        this.specs.set(spec.cmd.toLowerCase(), spec);
    }
    list() {
        return [...this.specs.values()];
    }
    get(cmd) {
        return this.specs.get(cmd.toLowerCase());
    }
    async execute(envelope, ctx) {
        if (this.executedIds.has(envelope.id)) {
            console.info('[ai] duplicate id ignored', { id: envelope.id });
            return false;
        }
        const spec = this.get(envelope.cmd);
        if (!spec) {
            console.warn('[ai] unknown command', envelope.cmd);
            return false;
        }
        const raw = spec.coerce ? spec.coerce(envelope.body) : envelope.body;
        const parsed = spec.schema.safeParse(raw);
        if (!parsed.success) {
            console.warn('[ai] invalid command body', { cmd: envelope.cmd, issues: parsed.error.issues });
            return false;
        }
        if (!this.checkPolicy(spec.policy, ctx)) {
            console.warn('[ai] policy denied', { cmd: envelope.cmd, policy: spec.policy });
            return false;
        }
        if (spec.preconditions && !spec.preconditions(ctx)) {
            console.warn('[ai] preconditions not met', { cmd: envelope.cmd });
            return false;
        }
        const now = Date.now();
        if (spec.policy?.cooldownMs) {
            const key = spec.cmd.toLowerCase();
            const last = this.lastExecAt.get(key) ?? 0;
            if (now - last < spec.policy.cooldownMs) {
                console.info('[ai] cooldown active', { cmd: spec.cmd });
                return false;
            }
            this.lastExecAt.set(key, now);
        }
        try {
            const ok = await spec.handler(parsed.data, ctx);
            if (ok) {
                this.executedIds.add(envelope.id);
                // Best-effort cap to avoid unbounded growth
                if (this.executedIds.size > 1024) {
                    this.executedIds.clear();
                }
            }
            return ok;
        }
        catch (err) {
            console.error('[ai] handler failed', { cmd: spec.cmd, err });
            return false;
        }
    }
    checkPolicy(policy, ctx) {
        if (!policy || policy.role === 'any' || !policy.role)
            return true;
        const me = ctx.participants.find((p) => p.id === ctx.localParticipantId);
        if (!me)
            return false;
        if (policy.role === 'host')
            return me.role === 'host';
        if (policy.role === 'guest')
            return me.role === 'guest';
        return true;
    }
}
export const commandRegistry = new Registry();
