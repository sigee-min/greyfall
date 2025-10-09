// Canonical whitelists for 1B-friendly structured tasks.
// Keep values lowercase; display names belong in i18n.
export const ACTIONS = [
    'sneak_move', 'melee_attack', 'ranged_attack', 'cast_spell', 'observe',
    'hide', 'dash', 'defend', 'interact', 'talk',
    // Extended actions handled by host side-effects
    'heal', 'item.give', 'equip', 'unequip',
    'no_action'
];
export const CHECKS = [
    'stealth', 'perception', 'athletics', 'acrobatics', 'insight',
    'intimidation', 'persuasion', 'survival', 'arcana'
];
export const HAZARDS = [
    // Note: effect semantics live in code; LLM selects IDs only.
    'thorns', 'slippery', 'darkness', 'trap', 'fire', 'poison_gas'
];
export const EFFECTS = [
    'hp.sub', 'hp.add', 'status.add', 'status.remove', 'reveal', 'move'
];
export const STATUSES = [
    'bleeding', 'prone', 'stunned', 'poisoned', 'burning',
    'restrained', 'blinded', 'invisible'
];
export const SAFETY_REASONS = [
    'violence_detail', 'sexual_content', 'hate', 'self_harm', 'minors',
    'doxxing', 'illicit', 'graphic_gore', 'other'
];
// Fast lookup sets
export const ACTION_SET = new Set(ACTIONS);
export const CHECK_SET = new Set(CHECKS);
export const HAZARD_SET = new Set(HAZARDS);
export const STATUS_SET = new Set(STATUSES);
export const SAFETY_REASON_SET = new Set(SAFETY_REASONS);
// Helpers (pure, no external deps)
export function inSet(set, v) {
    return typeof v === 'string' && set.has(v);
}
export function clampArray(arr, max) {
    const out = [];
    const seen = new Set();
    for (const item of arr) {
        const key = typeof item === 'string' ? item.toLowerCase() : JSON.stringify(item);
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(item);
        if (out.length >= Math.max(0, max))
            break;
    }
    return out;
}
