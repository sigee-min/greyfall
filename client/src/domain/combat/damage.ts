import type { StatKey } from '../stats/keys';

export type DamageParams = {
  attackerDerived?: Partial<Record<StatKey, number>>;
  defenderResists?: Record<string, number>; // kind → percent (0-80)
  defenderStatusTags?: string[];
  ability?: { kind?: string; power?: number };
};

export function computeDamage({ attackerDerived, defenderResists, defenderStatusTags, ability }: DamageParams): number {
  const power = Math.max(1, Math.floor(ability?.power ?? 5));
  const str = Math.max(0, Math.floor(attackerDerived?.Strength ?? 0));
  const raw = power + Math.floor(str * 0.5);
  const kind = (ability?.kind ?? 'blunt').toLowerCase();
  let resistPct = Math.max(0, Math.min(80, Math.floor(defenderResists?.[kind] ?? 0)));
  // Debuff-aware adjustment: generic 'vulnerable' reduces all resists by 10
  const tags = defenderStatusTags ?? [];
  if (tags.includes('vulnerable')) resistPct -= 10;
  if (tags.includes('vuln:blunt') && kind === 'blunt') resistPct -= 15;
  if (tags.includes('vuln:energy') && kind === 'energy') resistPct -= 15;
  if (tags.includes('vuln:pierce') && kind === 'pierce') resistPct -= 15;
  resistPct = Math.max(0, Math.min(80, resistPct));
  const after = Math.round(raw * (1 - resistPct / 100));
  return Math.max(1, Math.min(999, after));
}
