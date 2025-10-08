import type { ItemDef } from '../types';

export const BASIC_ITEMS: ItemDef[] = [
  // Potions
  {
    id: 'potion_small',
    category: 'consumable',
    names: [
      { locale: 'ko', text: '작은 회복 포션' },
      { locale: 'en', text: 'Small Healing Potion' }
    ],
    synonyms: ['포션', '작은포션', 'hp포션', 'potion', 'small potion', 'healing potion'],
    tags: ['healing', 'potion'],
    stackable: true,
    weight: 50
  },
  // Headgear
  {
    id: 'hat_simple',
    category: 'equipment',
    slot: 'head',
    names: [
      { locale: 'ko', text: '천 모자' },
      { locale: 'en', text: 'Cloth Cap' }
    ],
    synonyms: ['모자', 'cap', 'hat'],
    tags: ['headgear'],
    rarity: 'common'
  },
  {
    id: 'helmet_iron',
    category: 'equipment',
    slot: 'head',
    names: [
      { locale: 'ko', text: '강철 투구' },
      { locale: 'en', text: 'Iron Helmet' }
    ],
    synonyms: ['헬멧', 'helmet', 'helm'],
    tags: ['headgear'],
    rarity: 'uncommon'
  },
  // Armor
  {
    id: 'armor_leather',
    category: 'equipment',
    slot: 'body',
    names: [
      { locale: 'ko', text: '가죽 갑옷' },
      { locale: 'en', text: 'Leather Armor' }
    ],
    synonyms: ['갑옷', '가죽갑옷', 'armor'],
    tags: ['armor'],
    rarity: 'common'
  },
  // Shields
  {
    id: 'shield_wood',
    category: 'equipment',
    slot: 'offhand',
    names: [
      { locale: 'ko', text: '나무 방패' },
      { locale: 'en', text: 'Wooden Shield' }
    ],
    synonyms: ['방패', 'shield'],
    tags: ['shield'],
    rarity: 'common'
  },
  // Weapons
  {
    id: 'sword_short',
    category: 'equipment',
    slot: 'mainhand',
    names: [
      { locale: 'ko', text: '숏 소드' },
      { locale: 'en', text: 'Short Sword' }
    ],
    synonyms: ['검', 'sword'],
    tags: ['sword'],
    rarity: 'common'
  },
  {
    id: 'dagger',
    category: 'equipment',
    slot: 'mainhand',
    names: [
      { locale: 'ko', text: '단검' },
      { locale: 'en', text: 'Dagger' }
    ],
    synonyms: ['단검', 'dagger'],
    tags: ['dagger'],
    rarity: 'common'
  },
  {
    id: 'bow_short',
    category: 'equipment',
    slot: 'mainhand',
    names: [
      { locale: 'ko', text: '숏 보우' },
      { locale: 'en', text: 'Short Bow' }
    ],
    synonyms: ['활', 'bow'],
    tags: ['bow'],
    rarity: 'common'
  },
  {
    id: 'staff_wood',
    category: 'equipment',
    slot: 'mainhand',
    names: [
      { locale: 'ko', text: '나무 지팡이' },
      { locale: 'en', text: 'Wooden Staff' }
    ],
    synonyms: ['지팡이', 'staff'],
    tags: ['staff'],
    rarity: 'common'
  },
  // Accessories
  {
    id: 'ring_bronze',
    category: 'equipment',
    slot: 'accessory',
    names: [
      { locale: 'ko', text: '청동 반지' },
      { locale: 'en', text: 'Bronze Ring' }
    ],
    synonyms: ['반지', 'ring'],
    tags: ['ring'],
    rarity: 'common'
  },
  {
    id: 'amulet_bronze',
    category: 'equipment',
    slot: 'accessory',
    names: [
      { locale: 'ko', text: '청동 목걸이' },
      { locale: 'en', text: 'Bronze Amulet' }
    ],
    synonyms: ['목걸이', 'amulet', 'necklace'],
    tags: ['amulet'],
    rarity: 'common'
  }
];

