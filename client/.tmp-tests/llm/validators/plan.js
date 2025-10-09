import { ACTION_SET, CHECK_SET, HAZARD_SET, inSet, clampArray } from '../spec/whitelist';
import { isActorId, limitText } from '../spec/patterns';
const DEFAULTS = {
    maxChecks: 2,
    maxHazards: 2,
    maxTargets: 2,
    allowItem: true
};
export function validatePlanOutput(rawText, opts) {
    const p = { ...DEFAULTS, ...(opts ?? {}) };
    let obj = null;
    const trimmed = String(rawText ?? '').trim();
    if (!trimmed)
        return { ok: false, error: 'empty' };
    try {
        obj = JSON.parse(trimmed);
    }
    catch {
        return { ok: false, error: 'invalid_json' };
    }
    if (!obj || typeof obj !== 'object')
        return { ok: false, error: 'not_object' };
    const o = obj;
    const actionIn = typeof o.action === 'string' ? o.action.toLowerCase() : '';
    const action = inSet(ACTION_SET, actionIn) ? actionIn : 'no_action';
    const checksIn = Array.isArray(o.checks) ? o.checks.map(String) : [];
    const hazardsIn = Array.isArray(o.hazards) ? o.hazards.map(String) : [];
    const targetsIn = Array.isArray(o.targets) ? o.targets.map(String) : [];
    const checks = clampArray(checksIn.filter((c) => inSet(CHECK_SET, String(c).toLowerCase())), p.maxChecks);
    const hazards = clampArray(hazardsIn.filter((h) => inSet(HAZARD_SET, String(h).toLowerCase())), p.maxHazards);
    const targets = clampArray(targetsIn.filter((t) => isActorId(t)), p.maxTargets);
    const item = p.allowItem && typeof o.item === 'string' ? limitText(o.item, 40) ?? undefined : undefined;
    const reason = (() => {
        const meta = o.meta && typeof o.meta === 'object' ? o.meta : null;
        return meta && typeof meta.reason === 'string' ? limitText(meta.reason, 40) ?? undefined : undefined;
    })();
    const fixed = { action };
    if (checks.length)
        fixed.checks = checks;
    if (hazards.length)
        fixed.hazards = hazards;
    if (targets.length)
        fixed.targets = targets;
    if (item)
        fixed.item = item;
    if (reason)
        fixed.meta = { reason };
    return { ok: true, fixed };
}
