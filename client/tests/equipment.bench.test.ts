import { computeEquipmentSnapshot } from '../src/domain/equipment/aggregator';
import { registerItemEffects, getItemEffects } from '../src/domain/equipment/effect-registry';
import type { StatKey } from '../src/domain/stats/keys';

const base: Record<StatKey, number> = { Strength: 0, Agility: 0, Engineering: 0, Dexterity: 0, Medicine: 0 };
for (let i = 0; i < 10; i += 1) {
  registerItemEffects(`bench-${i}`, [{ kind: 'STAT', target: 'Strength', op: 'add', value: 1 }]);
}
const eq = Array.from({ length: 10 }, (_, i) => `bench-${i}`);
const effectsByItem = Object.fromEntries(eq.map((k) => [k, getItemEffects(k)]));

const t0 = Date.now();
for (let i = 0; i < 50; i += 1) {
  computeEquipmentSnapshot({ base, equipped: eq, effectsByItem }, { includeDerived: true });
}
const ms = Date.now() - t0;
console.log(`equipment.bench.test.ts completed ~${ms}ms for 50 runs`);

