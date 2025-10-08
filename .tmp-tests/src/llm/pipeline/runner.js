import { renderTemplate, withTimeoutRetry } from './utils';
// Progress bus removed; keep signature for potential future reintroduction.
const emitProgress = (_event) => { };
export async function runPipeline(options) {
    const { start, ctx, registry, exec } = options;
    let cur = start;
    while (cur) {
        const step = cur;
        const node = registry.get(step.nodeId);
        if (!node)
            throw new Error(`Unknown node: ${step.nodeId}`);
        const params = await step.params(ctx);
        const sys = renderTemplate(node.prompt.systemTpl, params);
        const userSuffix = node.prompt.userTpl ? renderTemplate(node.prompt.userTpl, params) : '';
        const messages = [
            { role: 'system', content: sys },
            { role: 'user', content: [ctx.user, userSuffix].filter(Boolean).join('\n') }
        ];
        emitProgress({ text: `${step.id} 실행`, progress: null });
        try {
            const overrides = readOverrides(ctx.scratch);
            const temperature = overrides.temperature ?? node.options?.temperature ?? 0.7;
            const maxTokens = overrides.maxTokens ?? node.options?.maxTokens ?? 512;
            const timeoutMs = overrides.timeoutMs ?? node.options?.timeoutMs ?? 20000;
            const retries = node.options?.retries ?? 0;
            const raw = await withTimeoutRetry(() => exec(messages, { temperature, maxTokens, timeoutMs, signal: ctx.signal }), { timeoutMs, retries, signal: ctx.signal });
            const text = node.validate ? (await node.validate(raw, ctx)).fixed ?? raw : raw;
            // Store last output into scratch for downstream steps
            ctx.scratch.last = { nodeId: node.id, text };
            cur = step.next ?? null;
        }
        catch (err) {
            emitProgress({ text: `${step.id} 실패: ${formatError(err)}`, progress: null });
            if (step.onErrorNext) {
                cur = step.onErrorNext;
                continue;
            }
            throw err;
        }
    }
    emitProgress({ text: '파이프라인 완료', progress: 1 });
    return ctx;
}
function readOverrides(scratch) {
    const raw = scratch.overrides;
    if (!raw || typeof raw !== 'object')
        return {};
    const record = raw;
    const readNumber = (value) => (typeof value === 'number' ? value : undefined);
    return {
        temperature: readNumber(record.temperature),
        maxTokens: readNumber(record.maxTokens),
        timeoutMs: readNumber(record.timeoutMs)
    };
}
function formatError(err) {
    return err instanceof Error ? err.message : String(err);
}
