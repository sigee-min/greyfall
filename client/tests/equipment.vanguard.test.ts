import { computeEquipmentSnapshot } from '../src/domain/equipment/aggregator';
import { initEquipmentEffects } from '../src/domain/equipment/bootstrap';
import { getItemEffects } from '../src/domain/equipment/effect-registry';
import type { StatKey } from '../src/domain/stats/keys';

initEquipmentEffects();

const base: Record<StatKey, number> = {
  Strength: 0,
  Agility: 0,
  Engineering: 0,
  Dexterity: 0,
  Medicine: 0
};

const eq = ['iron-helm', 'field-vest']; // vanguard x2 → blunt +10 via set bonus
const effectsByItem = Object.fromEntries(eq.map((k) => [k, getItemEffects(k)]));

const snap = computeEquipmentSnapshot({ base, equipped: eq, effectsByItem, rulesVersion: 'v1' }, { includeDerived: true });

if (!snap.modifiers?.resists || snap.modifiers.resists['blunt'] !== 10) {
  console.log('equipment.vanguard.test.ts failed: expected blunt +10 from vanguard(2)');
} else {
  console.log('equipment.vanguard.test.ts passed');
}

