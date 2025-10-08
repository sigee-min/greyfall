import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { CharacterLoadoutRegistry } from '../src/domain/character/loadout-registry.js';
const baseStats = {
    Strength: 2,
    Agility: 1,
    Engineering: 0,
    Dexterity: 3,
    Medicine: 0
};
const makeLoadout = (overrides) => ({
    playerId: 'player-1',
    roll: [3, 4, 5],
    budget: 12,
    remaining: 4,
    stats: { ...baseStats },
    passives: [{ id: 'stabilize+', name: '정밀 안정화', description: '+1', negative: false }],
    traits: [
        {
            id: 'precise-hands',
            name: '정밀한 손놀림',
            cost: 2,
            statMods: { Dexterity: 2 },
            description: '정밀 작업에 유리'
        }
    ],
    built: false,
    updatedAt: Date.now(),
    ...overrides
});
test('CharacterLoadoutRegistry: replace clones entries', () => {
    const registry = new CharacterLoadoutRegistry();
    const loadout = makeLoadout({ playerId: 'a' });
    registry.replace([loadout], 5);
    const snapshot = registry.getSnapshot();
    assert.equal(snapshot.revision, 5);
    assert.equal(snapshot.entries.length, 1);
    assert.equal(snapshot.byId['a'].playerId, 'a');
    // mutate original; snapshot should remain unchanged
    loadout.stats.Dexterity = 99;
    loadout.traits[0].name = '변경됨';
    const stored = registry.get('a');
    assert.ok(stored);
    assert.equal(stored?.stats.Dexterity, 3);
    assert.equal(stored?.traits[0].name, '정밀한 손놀림');
});
test('CharacterLoadoutRegistry: upsert increments revision', () => {
    const registry = new CharacterLoadoutRegistry();
    const loadout = makeLoadout({ playerId: 'b', updatedAt: 1 });
    registry.upsert(loadout);
    const snap1 = registry.getSnapshot();
    assert.equal(snap1.revision, 1);
    assert.equal(snap1.entries.length, 1);
    registry.upsert(makeLoadout({ playerId: 'b', built: true, updatedAt: 2 }));
    const snap2 = registry.getSnapshot();
    assert.equal(snap2.revision, 2);
    assert.equal(snap2.byId['b'].built, true);
    assert.equal(snap2.entries.length, 1);
});
test('CharacterLoadoutRegistry: remove and hasAllBuilt', () => {
    const registry = new CharacterLoadoutRegistry();
    registry.replace([
        makeLoadout({ playerId: 'p1', built: true }),
        makeLoadout({ playerId: 'p2', built: true }),
        makeLoadout({ playerId: 'p3', built: false })
    ]);
    assert.equal(registry.hasAllBuilt(['p1', 'p2']), true);
    assert.equal(registry.hasAllBuilt(['p1', 'p3']), false);
    const removed = registry.remove('p2');
    assert.equal(removed, true);
    assert.equal(registry.hasAllBuilt(['p1', 'p2']), false);
    const removedMissing = registry.remove('unknown');
    assert.equal(removedMissing, false);
});
