export function renderTemplate(tpl, params) {
    return tpl.replace(/\$\{\s*([a-zA-Z0-9_.]+)\s*\}/g, (_m, key) => {
        const val = get(params, String(key));
        if (val == null)
            return '';
        if (typeof val === 'object')
            return JSON.stringify(val);
        return String(val);
    });
}
function get(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current == null || typeof current !== 'object')
            return undefined;
        const record = current;
        current = record[part];
    }
    return current;
}
export async function withTimeoutRetry(work, opts) {
    const { timeoutMs, retries, signal } = opts;
    let attempt = 0;
    let lastError = null;
    while (attempt <= Math.max(0, retries)) {
        try {
            return await withTimeout(work(), timeoutMs, signal);
        }
        catch (err) {
            lastError = err;
            attempt += 1;
            if (attempt > Math.max(0, retries))
                break;
            await delay(200);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Unknown error'));
}
async function withTimeout(p, ms, signal) {
    let timer;
    return await Promise.race([
        p,
        new Promise((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error('timeout')), ms);
            if (signal) {
                const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
                if (signal.aborted)
                    onAbort();
                else
                    signal.addEventListener('abort', onAbort, { once: true });
            }
        })
    ]).finally(() => {
        if (timer !== undefined)
            clearTimeout(timer);
    });
}
async function delay(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
