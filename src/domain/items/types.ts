import type { EquipmentSlot } from '../world/equipment-rules';

export type ItemId = string;

export type ItemLocaleName = {
  locale: 'ko' | 'en';
  text: string;
};

export type ItemCategory = 'equipment' | 'consumable' | 'material' | 'quest' | 'misc';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type ItemDef = {
  id: ItemId;
  category: ItemCategory;
  // Display names per locale
  names: ItemLocaleName[];
  // Free-form synonyms/aliases (lowercase recommended)
  synonyms?: string[];
  // Equipment-only: slot mapping (undefined for non-equipment)
  slot?: EquipmentSlot;
  // Optional metadata used for filtering/rulesets
  tags?: string[];
  rarity?: Rarity;
  stackable?: boolean;
  weight?: number; // grams or abstract units
};

