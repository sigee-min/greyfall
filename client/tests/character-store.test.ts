import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import {
  useCharacterStore,
  type CharacterSnapshot,
  type TraitSpec
} from '../src/store/character.js';

const precisionTrait: TraitSpec = {
  id: 'precise-hands',
  name: '정밀한 손놀림',
  cost: 2,
  statMods: { Dexterity: 2 },
  passives: [{ id: 'stabilize+', name: '정밀 안정화', description: '+1' }]
};

const heavyTrait: TraitSpec = {
  id: 'heavy-armor',
  name: '중장 방어구',
  cost: 12,
  statMods: { Strength: 1 },
  description: '많은 자원을 소모'
};

const resetStore = () => {
  useCharacterStore.getState().reset();
};

test('CharacterStore: selectTrait updates stats and resets built flag', () => {
  resetStore();
  const store = useCharacterStore.getState();
  store.setRolled([3, 3, 3]); // budget 9
  store.finalize(); // set built true
  store.selectTrait(precisionTrait);

  const state = useCharacterStore.getState();
  assert.equal(state.traits.length, 1);
  assert.equal(state.remaining, 7);
  assert.equal(state.stats['Dexterity'], 2);
  assert.equal(state.passives.length, 1);
  assert.equal(state.built, false);

  store.selectTrait(precisionTrait); // duplicate ignored
  assert.equal(useCharacterStore.getState().traits.length, 1);
});

test('CharacterStore: prevents overspend when selecting trait', () => {
  resetStore();
  const store = useCharacterStore.getState();
  store.setRolled([2, 2, 2]); // budget 6
  store.selectTrait(heavyTrait);
  assert.equal(useCharacterStore.getState().traits.length, 0);
  assert.equal(useCharacterStore.getState().remaining, 6);
});

test('CharacterStore: deselectTrait recalculates stats and passives', () => {
  resetStore();
  const store = useCharacterStore.getState();
  store.setRolled([4, 4, 4]); // budget 12
  store.selectTrait(precisionTrait);
  store.deselectTrait(precisionTrait.id);

  const state = useCharacterStore.getState();
  assert.equal(state.traits.length, 0);
  assert.equal(state.stats['Dexterity'], 0);
  assert.equal(state.passives.length, 0);
  assert.equal(state.remaining, 12);
});

test('CharacterStore: hydrate clones incoming snapshot', () => {
  resetStore();
  const snapshot: CharacterSnapshot = {
    built: true,
    roll: [5, 5, 1],
    budget: 11,
    remaining: 6,
    stats: {
      Strength: 1,
      Agility: 0,
      Engineering: 0,
      Dexterity: 3,
      Medicine: 2
    },
    passives: [{ id: 'triage+', name: '신속 처치', description: '+1' }],
    traits: [
      {
        id: 'field-medic',
        name: '전장 위의 의사',
        cost: 4,
        statMods: { Medicine: 2, Agility: 1 },
        passives: [{ id: 'triage+', name: '신속 처치', description: '+1' }]
      }
    ]
  };

  useCharacterStore.getState().hydrate(snapshot);
  snapshot.stats.Dexterity = 99;
  snapshot.passives[0]!.name = '변형된 패시브';

  const state = useCharacterStore.getState();
  assert.equal(state.built, true);
  assert.equal(state.stats['Dexterity'], 3);
  assert.equal(state.passives[0]!.name, '신속 처치');
});

