import { parseJsonLine, normString } from './json-common';
export function validateNames(text) {
    const p = parseJsonLine(text);
    if (!p.ok || !p.value)
        return { ok: false, error: p.error };
    const arr = Array.isArray(p.value.names) ? p.value.names : [];
    const names = arr
        .map((n) => normString(n, 12))
        .filter((v) => Boolean(v))
        .filter((s) => /[A-Za-z가-힣]/u.test(s));
    const dedup = [];
    for (const n of names) {
        if (!dedup.includes(n) && dedup.length < 3)
            dedup.push(n);
    }
    if (dedup.length < 2)
        return { ok: false, error: 'need_2_3_names' };
    return { ok: true, fixed: JSON.stringify({ names: dedup }) };
}
