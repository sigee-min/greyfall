import { computeEquipmentSnapshot } from '../src/domain/equipment/aggregator';
import { getItemEffects, registerItemEffects } from '../src/domain/equipment/effect-registry';
import type { StatKey } from '../src/domain/stats/keys';

// Order-invariance property for pure add/mul aggregation given same multiset
const base: Record<StatKey, number> = { Strength: 10, Agility: 0, Engineering: 0, Dexterity: 0, Medicine: 0 };
registerItemEffects('tmp-a', [{ kind: 'STAT', target: 'Strength', op: 'add', value: 2 }]);
registerItemEffects('tmp-b', [{ kind: 'STAT', target: 'Strength', op: 'mul', value: 2 }]);

const A = ['tmp-a', 'tmp-b'];
const B = ['tmp-b', 'tmp-a'];
const effectsA: Record<string, ReturnType<typeof getItemEffects>> = Object.fromEntries(A.map((k) => [k, getItemEffects(k)]));
const effectsB: Record<string, ReturnType<typeof getItemEffects>> = Object.fromEntries(B.map((k) => [k, getItemEffects(k)]));

const sa = computeEquipmentSnapshot({ base, equipped: A, effectsByItem: effectsA }, { includeDerived: true });
const sb = computeEquipmentSnapshot({ base, equipped: B, effectsByItem: effectsB }, { includeDerived: true });

if ((sa.derived?.Strength ?? 0) !== (sb.derived?.Strength ?? 0)) {
  console.log('equipment.order.test.ts failed: expected order-invariant result');
} else {
  console.log('equipment.order.test.ts passed');
}

