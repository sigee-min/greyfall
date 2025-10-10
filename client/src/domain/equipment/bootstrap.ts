import { registerItemEffects } from './effect-registry';
import type { EffectSpec } from './effect-types';

let initialised = false;

export function initEquipmentEffects(): void {
  if (initialised) return;
  initialised = true;

  const E = (arr: EffectSpec[]) => arr;

  // Demo effects for a few equipment keys
  registerItemEffects('iron-helm', E([
    { kind: 'STAT', target: 'Strength', op: 'add', value: 1, setId: 'vanguard' }
  ]));

  registerItemEffects('tactical-visor', E([
    { kind: 'STAT', target: 'Engineering', op: 'add', value: 1 },
    { kind: 'TAG', tags: ['vision+'], value: 1 }
  ]));

  registerItemEffects('field-vest', E([
    { kind: 'RESIST', target: 'pierce', value: 10, setId: 'vanguard' }
  ]));

  registerItemEffects('ring-of-focus', E([
    { kind: 'STAT', target: 'Dexterity', op: 'add', value: 1, setId: 'arcane' }
  ]));

  // Additional lineup
  registerItemEffects('combat-armor', E([
    { kind: 'RESIST', target: 'pierce', value: 15 },
    { kind: 'RESIST', target: 'blunt', value: 10 }
  ]));

  registerItemEffects('kevlar-vest', E([
    { kind: 'RESIST', target: 'pierce', value: 20 }
  ]));

  registerItemEffects('storm-robe', E([
    { kind: 'RESIST', target: 'energy', value: 15, setId: 'arcane' }
  ]));

  registerItemEffects('steel-sword', E([
    { kind: 'STAT', target: 'Strength', op: 'add', value: 1, setId: 'vanguard' },
    { kind: 'TAG', tags: ['melee'], value: 1 }
  ]));

  registerItemEffects('scout-dagger', E([
    { kind: 'STAT', target: 'Dexterity', op: 'add', value: 1 },
    { kind: 'TAG', tags: ['light'], value: 1 }
  ]));

  registerItemEffects('engineer-wrench', E([
    { kind: 'STAT', target: 'Engineering', op: 'add', value: 1 }
  ]));

  registerItemEffects('storm-staff', E([
    { kind: 'RESIST', target: 'energy', value: 10, setId: 'arcane' },
    { kind: 'TAG', tags: ['caster'], value: 1 }
  ]));

  registerItemEffects('heavy-shield', E([
    { kind: 'RESIST', target: 'blunt', value: 15 },
    { kind: 'RESIST', target: 'pierce', value: 10 }
  ]));

  registerItemEffects('buckler-shield', E([
    { kind: 'RESIST', target: 'pierce', value: 8 }
  ]));

  registerItemEffects('amulet-of-vigor', E([
    { kind: 'STAT', target: 'Strength', op: 'add', value: 1 }
  ]));

  registerItemEffects('belt-of-tools', E([
    { kind: 'STAT', target: 'Engineering', op: 'add', value: 1 }
  ]));

  registerItemEffects('lantern-charm', E([
    { kind: 'TAG', tags: ['lucky'], value: 1 }
  ]));
}
