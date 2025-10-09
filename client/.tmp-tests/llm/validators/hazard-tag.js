import { parseJsonLine, normString } from './json-common';
import { HAZARD_SET, inSet } from '../spec/whitelist';
export function validateHazardTag(text) {
    const p = parseJsonLine(text);
    if (!p.ok || !p.value)
        return { ok: false, error: p.error };
    const arr = Array.isArray(p.value.hazards) ? p.value.hazards : [];
    const hazards = [];
    for (const h of arr) {
        const s = normString(h, 32);
        if (s && inSet(HAZARD_SET, s.toLowerCase()) && !hazards.includes(s))
            hazards.push(s);
        if (hazards.length >= 2)
            break;
    }
    return { ok: true, fixed: JSON.stringify({ hazards }) };
}
