import type { EffectSpec } from './effect-types';

const EFFECTS: Record<string, EffectSpec[]> = Object.create(null);

export function registerItemEffects(key: string, effects: EffectSpec[]): void {
  EFFECTS[String(key)] = Array.isArray(effects) ? effects.slice() : [];
}

export function getItemEffects(key: string): EffectSpec[] {
  return EFFECTS[String(key)] ?? [];
}

export function getAllRegisteredEffects(): Record<string, EffectSpec[]> {
  return { ...EFFECTS };
}

