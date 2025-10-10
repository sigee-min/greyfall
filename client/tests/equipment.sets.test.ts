import { computeEquipmentSnapshot } from '../src/domain/equipment/aggregator';
import { getItemEffects } from '../src/domain/equipment/effect-registry';
import { initEquipmentEffects } from '../src/domain/equipment/bootstrap';
import type { StatKey } from '../src/domain/stats/keys';

initEquipmentEffects();

const base: Record<StatKey, number> = {
  Strength: 1,
  Agility: 1,
  Engineering: 1,
  Dexterity: 1,
  Medicine: 1
};

const eq = ['iron-helm', 'field-vest'];
const effectsByItem: Record<string, ReturnType<typeof getItemEffects>> = Object.fromEntries(
  eq.map((k) => [k, getItemEffects(k)])
);

const snap = computeEquipmentSnapshot({ base, equipped: eq, effectsByItem, rulesVersion: 'v1' }, { includeDerived: true });

if (!snap.setsProgress || snap.setsProgress.length === 0) {
  console.log('equipment.sets.test.ts failed: expected setsProgress');
} else {
  console.log('equipment.sets.test.ts passed');
}

