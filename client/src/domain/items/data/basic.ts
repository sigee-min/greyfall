import type { ItemDef } from '../types';

export const BASIC_ITEMS: ItemDef[] = [
  {
    id: 'bandage',
    category: 'consumable',
    names: [
      { locale: 'en', text: 'Bandage' },
      { locale: 'ko', text: '붕대' }
    ],
    synonyms: ['wrap', 'gauze'],
    tags: ['healing'],
    rarity: 'common',
    stackable: true,
    weight: 20
  }
];

