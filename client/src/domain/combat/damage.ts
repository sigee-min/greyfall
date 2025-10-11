import type { StatKey } from '../stats/keys';

export type DamageParams = {
  attackerDerived?: Partial<Record<StatKey, number>>;
  defenderResists?: Record<string, number>; // kind → percent (0-80)
  ability?: { kind?: string; power?: number };
};

export function computeDamage({ attackerDerived, defenderResists, ability }: DamageParams): number {
  const power = Math.max(1, Math.floor(ability?.power ?? 5));
  const str = Math.max(0, Math.floor(attackerDerived?.Strength ?? 0));
  const raw = power + Math.floor(str * 0.5);
  const kind = (ability?.kind ?? 'blunt').toLowerCase();
  const resistPct = Math.max(0, Math.min(80, Math.floor(defenderResists?.[kind] ?? 0)));
  const after = Math.round(raw * (1 - resistPct / 100));
  return Math.max(1, Math.min(999, after));
}

