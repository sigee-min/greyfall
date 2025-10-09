// Canonical patterns and lightweight guards for IDs used in prompts/spec.
export const ACTOR_ID_REGEX = /^(p|e|n|a):[a-z0-9-]+$/;
export function isActorId(v) {
    return typeof v === 'string' && ACTOR_ID_REGEX.test(v);
}
export function limitText(s, max = 60) {
    if (typeof s !== 'string')
        return null;
    const t = s.trim();
    if (!t)
        return null;
    return t.length <= max ? t : t.slice(0, Math.max(0, max));
}
