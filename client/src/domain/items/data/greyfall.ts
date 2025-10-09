import type { ItemDef } from '../types';

export const GREYFALL_ITEMS: ItemDef[] = [
  {
    id: 'glow-cell',
    category: 'material',
    names: [
      { locale: 'en', text: 'Glow Cell' },
      { locale: 'ko', text: '글로우 셀' }
    ],
    tags: ['energy'],
    rarity: 'uncommon',
    stackable: true,
    weight: 50
  }
];

