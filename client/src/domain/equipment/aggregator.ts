import { ALL_STAT_KEYS, type StatKey } from '../stats/keys';
import type { EffectSpec, EquipmentAggregationInput, EquipmentAggregationResult, Modifiers } from './effect-types';

function emptyModifiers(): Modifiers {
  const stats = Object.create(null) as Modifiers['stats'];
  for (const k of ALL_STAT_KEYS) stats[k] = { add: 0, mul: 1 };
  return { stats, statuses: [], resists: {}, tags: [] };
}

function clamp(v: number, min: number, max: number): number { return Math.max(min, Math.min(max, v)); }

function normalizeEffects(specs: EffectSpec[]): EffectSpec[] {
  return specs.map((e) => ({ ...e, op: e.op ?? 'add' }));
}

function applyEffect(mods: Modifiers, e: EffectSpec): void {
  switch (e.kind) {
    case 'STAT': {
      const key = String(e.target) as StatKey;
      if (!(key in mods.stats)) break;
      const v = typeof e.value === 'number' ? e.value : 0;
      if (e.op === 'mul') mods.stats[key].mul *= v;
      else mods.stats[key].add += v;
      break;
    }
    case 'STATUS': {
      const s = String(e.target ?? e.value);
      mods.statuses.push(s);
      break;
    }
    case 'RESIST': {
      const k = String(e.target ?? 'generic');
      const v = typeof e.value === 'number' ? e.value : 0;
      const cur = mods.resists[k] ?? 0;
      mods.resists[k] = clamp(cur + v, 0, 80);
      break;
    }
    case 'TAG': {
      if (Array.isArray(e.tags)) {
        for (const t of e.tags) if (!mods.tags.includes(t)) mods.tags.push(t);
      }
      break;
    }
    case 'SET': {
      break;
    }
    default:
      break;
  }
}

function resolveSetBonuses(effectsByItem: Record<string, EffectSpec[]>, equipped: string[]): EffectSpec[] {
  const counts = new Map<string, number>();
  for (const key of equipped) {
    const list = effectsByItem[key] ?? [];
    for (const e of list) {
      if (e.setId) counts.set(e.setId, (counts.get(e.setId) ?? 0) + 1);
    }
  }
  const out: EffectSpec[] = [];
  for (const [setId, n] of counts) {
    const tiers: Array<2 | 4 | 6> = [2, 4, 6];
    for (const t of tiers) {
      if (n >= t) {
        const bonus = { kind: 'TAG', tags: [`set:${setId}:${t}`] } as EffectSpec;
        out.push(bonus);
      }
    }
  }
  return out;
}

function effectsHash(input: EquipmentAggregationInput): string {
  const data = {
    eq: [...input.equipped].sort(),
    rv: input.rulesVersion ?? 'v1'
  };
  const s = JSON.stringify(data);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fx_${(h >>> 0).toString(16)}`;
}

export function computeEquipmentSnapshot(input: EquipmentAggregationInput, opts?: { includeDerived?: boolean; trace?: boolean }): EquipmentAggregationResult {
  const { base, equipped, effectsByItem } = input;
  const mods = emptyModifiers();
  const trace: Array<{ itemKey: string; effectIndex: number }> = [];
  const orderedKeys = [...equipped];
  for (const key of orderedKeys) {
    const list = normalizeEffects(effectsByItem[key] ?? []);
    for (let i = 0; i < list.length; i += 1) {
      applyEffect(mods, list[i]!);
      if (opts?.trace) trace.push({ itemKey: key, effectIndex: i });
    }
  }
  const setBonuses = resolveSetBonuses(effectsByItem, orderedKeys);
  for (let i = 0; i < setBonuses.length; i += 1) applyEffect(mods, setBonuses[i]!);
  const derived: Partial<Record<StatKey, number>> = {};
  if (opts?.includeDerived) {
    for (const k of ALL_STAT_KEYS) {
      const b = base[k] ?? 0;
      const m = mods.stats[k];
      const v = clamp(Math.round((b + m.add) * m.mul), 0, 999);
      derived[k] = v;
    }
  }
  return { modifiers: mods, derived: opts?.includeDerived ? derived : undefined, effectsHash: effectsHash(input), trace: opts?.trace ? trace : undefined };
}

