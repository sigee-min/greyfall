import { parseJsonLine, normString } from './json-common';
import { SAFETY_REASON_SET } from '../spec/whitelist';
export function validateSafetyScreen(text) {
    const p = parseJsonLine(text);
    if (!p.ok || !p.value)
        return { ok: false, error: p.error };
    const flag = typeof p.value.flag === 'boolean' ? p.value.flag : false;
    const arr = Array.isArray(p.value.reasons) ? p.value.reasons : [];
    const reasons = [];
    for (const r of arr) {
        const s = normString(r, 32);
        if (s && SAFETY_REASON_SET.has(s) && !reasons.includes(s) && reasons.length < 3)
            reasons.push(s);
    }
    const suggest = normString(p.value.suggest, 50) ?? undefined;
    const out = { flag, reasons };
    if (suggest)
        out.suggest = suggest;
    return { ok: true, fixed: JSON.stringify(out) };
}
