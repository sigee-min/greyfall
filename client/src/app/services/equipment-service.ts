import { readActor } from '../adapters/net-actors-adapter';
import { itemSlot, slotCapacity } from '../../domain/world/equipment-rules';
import { getMissionState } from '../../domain/mission/state';
import { DEFAULT_MISSION_POLICY } from '../../domain/equipment/policy';

export type CanEquipReason = 'slot-capacity' | 'unavailable' | 'combat-restricted';
export type CanEquipResult = { allowed: true } | { allowed: false; reason: CanEquipReason };

export function canEquipSlotOnly(actorId: string | null, itemKey: string): CanEquipResult {
  if (!actorId) return { allowed: false, reason: 'unavailable' } as const;
  const actor = readActor(actorId);
  if (!actor) return { allowed: false, reason: 'unavailable' } as const;
  // Combat restriction
  const ms = getMissionState();
  const policy = DEFAULT_MISSION_POLICY[ms];
  if (!policy.canEquip) return { allowed: false, reason: 'combat-restricted' } as const;
  const slot = itemSlot(itemKey);
  const cap = slotCapacity(slot);
  const equipped = Array.isArray(actor.equipment) ? actor.equipment : [];
  const used = equipped.filter((k) => itemSlot(k) === slot).length;
  if (used >= cap) return { allowed: false, reason: 'slot-capacity' } as const;
  return { allowed: true } as const;
}
