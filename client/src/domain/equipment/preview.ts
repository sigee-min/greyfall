import type { StatKey } from '../stats/keys';
import type { ActorEntry } from '../net-objects/world-actors-client';
import { computeEquipmentSnapshot } from './aggregator';
import { getItemEffects } from './effect-registry';
import { RULES_VERSION } from './rules';

export type PreviewChange = { add?: string; remove?: string };

export function previewWithChange(actor: ActorEntry, base: Record<StatKey, number>, change: PreviewChange) {
  const equipped = new Set<string>(Array.isArray(actor.equipment) ? actor.equipment : []);
  if (change.remove) equipped.delete(change.remove);
  if (change.add) equipped.add(change.add);
  const eq = [...equipped];
  const effectsByItem: Record<string, ReturnType<typeof getItemEffects>> = {};
  for (const k of eq) effectsByItem[k] = getItemEffects(k);
  return computeEquipmentSnapshot({ base, equipped: eq, effectsByItem, rulesVersion: RULES_VERSION }, { includeDerived: true, trace: false });
}

