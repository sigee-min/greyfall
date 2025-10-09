import { parseJsonLine, normString } from './json-common';
import { isActorId } from '../spec/patterns';
export function validateEntityLink(text) {
    const p = parseJsonLine(text);
    if (!p.ok || !p.value)
        return { ok: false, error: p.error };
    const arr = Array.isArray(p.value.refs) ? p.value.refs : [];
    const out = [];
    for (const r of arr) {
        const o = r;
        const t = normString(o?.text, 24);
        const a = typeof o?.actor === 'string' && isActorId(o.actor) ? String(o.actor) : null;
        if (t && a) {
            out.push({ text: t, actor: a });
            if (out.length >= 3)
                break;
        }
    }
    return { ok: true, fixed: JSON.stringify({ refs: out }) };
}
