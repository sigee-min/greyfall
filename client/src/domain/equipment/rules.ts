import { itemSlot, slotCapacity } from '../world/equipment-rules';

export type EquipmentSlot = ReturnType<typeof itemSlot>;

export function canEquip(currentEquipped: string[], nextKey: string): { allowed: boolean; reason?: string } {
  const slot = itemSlot(nextKey);
  const cap = slotCapacity(slot);
  const inSlot = currentEquipped.filter((k) => itemSlot(k) === slot).length;
  if (inSlot >= cap) return { allowed: false, reason: 'slot-capacity' };
  return { allowed: true };
}

export const RULES_VERSION = 'equip-rules.v1';

