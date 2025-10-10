export type EquipmentSlot = 'head' | 'body' | 'mainhand' | 'offhand' | 'accessory' | 'misc';

// Very lightweight mapping; extend as your item keys grow.
export function itemSlot(key: string): EquipmentSlot {
  const k = String(key || '').toLowerCase();
  if (/hat|cap|helmet|helm|hood|visor|goggle/.test(k)) return 'head';
  if (/armor|armour|chest|plate|vest|robe|jacket/.test(k)) return 'body';
  if (/shield|buckler/.test(k)) return 'offhand';
  if (/sword|dagger|knife|axe|mace|hammer|wrench|staff|spear|bow|gun|pistol|rifle/.test(k)) return 'mainhand';
  if (/ring|amulet|necklace|bracelet|belt|charm/.test(k)) return 'accessory';
  return 'misc';
}

export function slotCapacity(slot: EquipmentSlot): number {
  switch (slot) {
    case 'head':
    case 'body':
    case 'mainhand':
    case 'offhand':
      return 1;
    case 'accessory':
      return 1; // one accessory at a time (reduced from 2)
    case 'misc':
    default:
      return 99; // effectively unlimited (not slot-bound)
  }
}
