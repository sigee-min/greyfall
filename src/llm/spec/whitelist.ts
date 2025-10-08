// Canonical whitelists for 1B-friendly structured tasks.
// Keep values lowercase; display names belong in i18n.

export type ActorRole = 'player' | 'enemy' | 'ally' | 'neutral';

export const ACTIONS = [
  'sneak_move', 'melee_attack', 'ranged_attack', 'cast_spell', 'observe',
  'hide', 'dash', 'defend', 'interact', 'talk', 'no_action'
] as const;
export type ActionId = (typeof ACTIONS)[number];

export const CHECKS = [
  'stealth', 'perception', 'athletics', 'acrobatics', 'insight',
  'intimidation', 'persuasion', 'survival', 'arcana'
] as const;
export type CheckId = (typeof CHECKS)[number];

export const HAZARDS = [
  // Note: effect semantics live in code; LLM selects IDs only.
  'thorns', 'slippery', 'darkness', 'trap', 'fire', 'poison_gas'
] as const;
export type HazardId = (typeof HAZARDS)[number];

export const EFFECTS = [
  'hp.sub', 'hp.add', 'status.add', 'status.remove', 'reveal', 'move'
] as const;
export type EffectBaseId = (typeof EFFECTS)[number];

export const STATUSES = [
  'bleeding', 'prone', 'stunned', 'poisoned', 'burning',
  'restrained', 'blinded', 'invisible'
] as const;
export type StatusId = (typeof STATUSES)[number];

export const SAFETY_REASONS = [
  'violence_detail', 'sexual_content', 'hate', 'self_harm', 'minors',
  'doxxing', 'illicit', 'graphic_gore', 'other'
] as const;
export type SafetyReasonId = (typeof SAFETY_REASONS)[number];

// Fast lookup sets
export const ACTION_SET = new Set<string>(ACTIONS);
export const CHECK_SET = new Set<string>(CHECKS);
export const HAZARD_SET = new Set<string>(HAZARDS);
export const STATUS_SET = new Set<string>(STATUSES);
export const SAFETY_REASON_SET = new Set<string>(SAFETY_REASONS);

// Helpers (pure, no external deps)
export function inSet<T extends string>(set: Set<string>, v: unknown): v is T {
  return typeof v === 'string' && set.has(v);
}

export function clampArray<T>(arr: T[], max: number): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const key = typeof item === 'string' ? item.toLowerCase() : JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= Math.max(0, max)) break;
  }
  return out;
}

