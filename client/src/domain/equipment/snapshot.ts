import type { StatKey } from '../stats/keys';
import type { Modifiers } from './effect-types';

export type ActorEquipSnapshot = {
  base: Record<StatKey, number>;
  modifiers?: Modifiers;
  derived?: Partial<Record<StatKey, number>>;
  effectsHash?: string;
  schemaVersion: number;
};

export function mergeModifiers(a: Modifiers, b: Modifiers): Modifiers {
  const out: Modifiers = {
    stats: { ...a.stats },
    statuses: [...a.statuses],
    resists: { ...a.resists },
    tags: [...a.tags]
  };
  for (const [k, v] of Object.entries(b.stats) as Array<[StatKey, { add: number; mul: number }]>) {
    const cur = out.stats[k];
    if (cur) { cur.add += v.add; cur.mul *= v.mul; }
    else { out.stats[k] = { add: v.add, mul: v.mul }; }
  }
  for (const s of b.statuses) if (!out.statuses.includes(s)) out.statuses.push(s);
  for (const [k, v] of Object.entries(b.resists)) out.resists[k] = (out.resists[k] ?? 0) + v;
  for (const t of b.tags) if (!out.tags.includes(t)) out.tags.push(t);
  return out;
}
