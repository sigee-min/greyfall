export function parseJsonLine(text) {
    const t = String(text ?? '').trim();
    if (!t)
        return { ok: false, error: 'empty' };
    try {
        const obj = JSON.parse(t);
        return { ok: true, value: obj };
    }
    catch {
        return { ok: false, error: 'invalid_json' };
    }
}
export function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
export function normString(v, maxLen) {
    if (typeof v !== 'string')
        return null;
    const s = v.trim();
    if (!s)
        return null;
    return s.length <= maxLen ? s : s.slice(0, maxLen);
}
