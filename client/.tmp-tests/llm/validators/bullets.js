import { parseJsonLine, normString } from './json-common';
export function validateBullets(text, maxLenPerItem = 48) {
    const p = parseJsonLine(text);
    if (!p.ok || !p.value)
        return { ok: false, error: p.error };
    const arr = Array.isArray(p.value.bullets) ? p.value.bullets : [];
    const bullets = arr.map((b) => normString(b, maxLenPerItem)).filter((v) => Boolean(v));
    const dedup = [];
    for (const b of bullets) {
        if (!dedup.includes(b) && dedup.length < 3)
            dedup.push(b);
    }
    if (dedup.length < 1)
        return { ok: false, error: 'empty_bullets' };
    return { ok: true, fixed: JSON.stringify({ bullets: dedup.slice(0, 3) }) };
}
