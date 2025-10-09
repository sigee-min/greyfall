// Centralised item alias dictionary and resolver.
// Map common Korean/English names and nicknames to canonical keys used in inventory/equipment.
const ALIASES = {
    // Potions
    '포션': 'potion_small',
    '작은포션': 'potion_small',
    '회복포션': 'potion_small',
    'hp포션': 'potion_small',
    'potion': 'potion_small',
    'small potion': 'potion_small',
    'healing potion': 'potion_small',
    // Headgear
    '모자': 'hat_simple',
    '모자(가죽)': 'hat_leather',
    '헬멧': 'helmet_iron',
    'helmet': 'helmet_iron',
    'cap': 'hat_simple',
    'hood': 'hood_cloth',
    // Armor
    '갑옷': 'armor_leather',
    '가죽갑옷': 'armor_leather',
    'chain': 'armor_chain',
    'plate': 'armor_plate',
    'armor': 'armor_leather',
    // Shields
    '방패': 'shield_wood',
    'buckler': 'shield_buckler',
    'shield': 'shield_wood',
    // Weapons
    '검': 'sword_short',
    '단검': 'dagger',
    '활': 'bow_short',
    '지팡이': 'staff_wood',
    'sword': 'sword_short',
    'dagger': 'dagger',
    'bow': 'bow_short',
    'staff': 'staff_wood',
    // Accessories
    '반지': 'ring_bronze',
    '목걸이': 'amulet_bronze',
    'ring': 'ring_bronze',
    'amulet': 'amulet_bronze',
    'necklace': 'amulet_bronze'
};
export function resolveItemAlias(raw, inventoryKeys) {
    const t = String(raw || '').trim().toLowerCase();
    if (ALIASES[t])
        return ALIASES[t];
    const inv = (inventoryKeys ?? []).map((k) => String(k));
    const direct = inv.find((k) => k.toLowerCase() === t);
    if (direct)
        return direct;
    const contains = inv.find((k) => k.toLowerCase().includes(t));
    return contains ?? t;
}
