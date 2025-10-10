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
  },
  {
    id: 'iron-helm',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Iron Helm' }, { locale: 'ko', text: '강철 투구' } ],
    synonyms: ['helmet','helm'],
    tags: ['defense'],
    rarity: 'common',
    weight: 1200
  },
  {
    id: 'tactical-visor',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Tactical Visor' }, { locale: 'ko', text: '전술 바이저' } ],
    synonyms: ['visor','goggle'],
    tags: ['utility'],
    rarity: 'uncommon',
    weight: 300
  },
  {
    id: 'field-vest',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Field Vest' }, { locale: 'ko', text: '전술 조끼' } ],
    synonyms: ['armor','vest'],
    tags: ['defense'],
    rarity: 'uncommon',
    weight: 1800
  },
  {
    id: 'ring-of-focus',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Ring of Focus' }, { locale: 'ko', text: '집중의 반지' } ],
    synonyms: ['ring'],
    tags: ['accessory'],
    rarity: 'rare',
    weight: 20
  },
  {
    id: 'combat-armor',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Combat Armor' }, { locale: 'ko', text: '전투 장갑' } ],
    synonyms: ['armor','plate','jacket'],
    tags: ['defense'],
    rarity: 'uncommon',
    weight: 4500
  },
  {
    id: 'kevlar-vest',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Kevlar Vest' }, { locale: 'ko', text: '케블라 조끼' } ],
    synonyms: ['vest','armor'],
    tags: ['defense'],
    rarity: 'uncommon',
    weight: 2200
  },
  {
    id: 'storm-robe',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Storm Robe' }, { locale: 'ko', text: '폭풍 로브' } ],
    synonyms: ['robe','cloak'],
    tags: ['mystic'],
    rarity: 'rare',
    weight: 1000
  },
  {
    id: 'steel-sword',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Steel Sword' }, { locale: 'ko', text: '강철 검' } ],
    synonyms: ['sword'],
    tags: ['melee'],
    rarity: 'common',
    weight: 1400
  },
  {
    id: 'scout-dagger',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Scout Dagger' }, { locale: 'ko', text: '정찰용 단검' } ],
    synonyms: ['dagger','knife'],
    tags: ['light'],
    rarity: 'common',
    weight: 300
  },
  {
    id: 'engineer-wrench',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Engineer Wrench' }, { locale: 'ko', text: '엔지니어 렌치' } ],
    synonyms: ['wrench','spanner'],
    tags: ['tool'],
    rarity: 'common',
    weight: 800
  },
  {
    id: 'storm-staff',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Storm Staff' }, { locale: 'ko', text: '폭풍 지팡이' } ],
    synonyms: ['staff'],
    tags: ['caster'],
    rarity: 'rare',
    weight: 1200
  },
  {
    id: 'heavy-shield',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Heavy Shield' }, { locale: 'ko', text: '중형 방패' } ],
    synonyms: ['shield'],
    tags: ['defense'],
    rarity: 'uncommon',
    weight: 3000
  },
  {
    id: 'buckler-shield',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Buckler' }, { locale: 'ko', text: '버클러' } ],
    synonyms: ['buckler','shield'],
    tags: ['defense','light'],
    rarity: 'common',
    weight: 1200
  },
  {
    id: 'amulet-of-vigor',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Amulet of Vigor' }, { locale: 'ko', text: '활력의 부적' } ],
    synonyms: ['amulet','necklace'],
    tags: ['accessory'],
    rarity: 'rare',
    weight: 50
  },
  {
    id: 'belt-of-tools',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Belt of Tools' }, { locale: 'ko', text: '공구 벨트' } ],
    synonyms: ['belt'],
    tags: ['accessory','tool'],
    rarity: 'common',
    weight: 400
  },
  {
    id: 'lantern-charm',
    category: 'equipment',
    names: [ { locale: 'en', text: 'Lantern Charm' }, { locale: 'ko', text: '랜턴 부적' } ],
    synonyms: ['charm'],
    tags: ['accessory','lucky'],
    rarity: 'uncommon',
    weight: 30
  }
];
