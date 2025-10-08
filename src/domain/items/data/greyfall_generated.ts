import type { ItemDef } from '../types';

type Slot = 'head' | 'body' | 'mainhand' | 'offhand' | 'accessory';

const FAMILIES: Array<{ key: string; slot: Slot; ko: string; en: string; synonyms?: string[] }>= [
  // head
  { key: 'visor', slot: 'head', ko: '바이저', en: 'Visor', synonyms: ['바이저','visor'] },
  { key: 'helmet', slot: 'head', ko: '헬멧', en: 'Helmet', synonyms: ['헬멧','helmet','helm'] },
  { key: 'hood', slot: 'head', ko: '후드', en: 'Hood', synonyms: ['후드','hood'] },
  { key: 'mask', slot: 'head', ko: '마스크', en: 'Mask', synonyms: ['마스크','mask'] },
  { key: 'goggles', slot: 'head', ko: '고글', en: 'Goggles', synonyms: ['고글','goggles'] },
  { key: 'cap', slot: 'head', ko: '캡', en: 'Cap', synonyms: ['캡','cap','hat'] },
  // body
  { key: 'coat', slot: 'body', ko: '코트', en: 'Coat', synonyms: ['코트','coat'] },
  { key: 'jacket', slot: 'body', ko: '재킷', en: 'Jacket', synonyms: ['재킷','jacket'] },
  { key: 'vest', slot: 'body', ko: '베스트', en: 'Vest', synonyms: ['베스트','vest'] },
  { key: 'armor', slot: 'body', ko: '아머', en: 'Armor', synonyms: ['갑옷','아머','armor'] },
  { key: 'cloak', slot: 'body', ko: '망토', en: 'Cloak', synonyms: ['망토','cloak'] },
  { key: 'suit', slot: 'body', ko: '슈트', en: 'Suit', synonyms: ['슈트','suit'] },
  // mainhand
  { key: 'sword', slot: 'mainhand', ko: '소드', en: 'Sword', synonyms: ['검','sword','blade'] },
  { key: 'dagger', slot: 'mainhand', ko: '대거', en: 'Dagger', synonyms: ['단검','dagger'] },
  { key: 'machete', slot: 'mainhand', ko: '마체테', en: 'Machete', synonyms: ['마체테','machete'] },
  { key: 'axe', slot: 'mainhand', ko: '액스', en: 'Axe', synonyms: ['도끼','axe'] },
  { key: 'hammer', slot: 'mainhand', ko: '해머', en: 'Hammer', synonyms: ['해머','hammer'] },
  { key: 'staff', slot: 'mainhand', ko: '지팡이', en: 'Staff', synonyms: ['지팡이','staff'] },
  { key: 'spear', slot: 'mainhand', ko: '스피어', en: 'Spear', synonyms: ['창','spear','pike'] },
  { key: 'baton', slot: 'mainhand', ko: '바톤', en: 'Baton', synonyms: ['바톤','baton'] },
  { key: 'whip', slot: 'mainhand', ko: '채찍', en: 'Whip', synonyms: ['채찍','whip'] },
  { key: 'pistol', slot: 'mainhand', ko: '권총', en: 'Pistol', synonyms: ['권총','pistol'] },
  { key: 'revolver', slot: 'mainhand', ko: '리볼버', en: 'Revolver', synonyms: ['리볼버','revolver'] },
  { key: 'smg', slot: 'mainhand', ko: 'SMG', en: 'SMG', synonyms: ['기관단총','smg'] },
  { key: 'carbine', slot: 'mainhand', ko: '카빈', en: 'Carbine', synonyms: ['카빈','carbine'] },
  { key: 'rifle', slot: 'mainhand', ko: '라이플', en: 'Rifle', synonyms: ['라이플','rifle'] },
  { key: 'wand', slot: 'mainhand', ko: '완드', en: 'Wand', synonyms: ['완드','wand'] },
  // offhand
  { key: 'shield', slot: 'offhand', ko: '실드', en: 'Shield', synonyms: ['방패','실드','shield'] },
  { key: 'buckler', slot: 'offhand', ko: '버클러', en: 'Buckler', synonyms: ['버클러','buckler'] },
  { key: 'lamp', slot: 'offhand', ko: '램프', en: 'Lamp', synonyms: ['램프','lamp','lantern'] },
  { key: 'tome', slot: 'offhand', ko: '토메', en: 'Tome', synonyms: ['서책','tome','book'] },
  // accessory
  { key: 'ring', slot: 'accessory', ko: '링', en: 'Ring', synonyms: ['반지','ring'] },
  { key: 'amulet', slot: 'accessory', ko: '아뮬렛', en: 'Amulet', synonyms: ['목걸이','amulet','necklace','pendant'] },
  { key: 'band', slot: 'accessory', ko: '밴드', en: 'Band', synonyms: ['밴드','band','bracelet'] },
  { key: 'charm', slot: 'accessory', ko: '참', en: 'Charm', synonyms: ['참','charm'] },
];

const VARIANTS: Array<{ key: string; ko: string; en: string; tags: string[] }>= [
  { key: 'riot', ko: '라이엇', en: 'Riot', tags: ['riot'] },
  { key: 'arc', ko: '아크', en: 'Arc', tags: ['arc'] },
  { key: 'void', ko: '보이드', en: 'Void', tags: ['void','occult'] },
  { key: 'guild', ko: '길드', en: 'Guild', tags: ['guild'] },
  { key: 'stealth', ko: '스텔스', en: 'Stealth', tags: ['stealth'] },
  { key: 'industrial', ko: '인더스트리', en: 'Industrial', tags: ['industrial'] },
  { key: 'insulated', ko: '절연', en: 'Insulated', tags: ['insulated','arc'] },
  { key: 'lantern', ko: '랜턴', en: 'Lantern', tags: ['lantern'] },
  { key: 'medic', ko: '메딕', en: 'Medic', tags: ['medic'] },
  { key: 'tinker', ko: '팅커', en: 'Tinker', tags: ['tinker'] },
  { key: 'resist', ko: '레지스트', en: 'Resist', tags: ['resistance'] },
  { key: 'carbon', ko: '카본', en: 'Carbon', tags: ['armor'] },
];

const GRADES: Array<{ key: string; rarity: ItemDef['rarity']; ko?: string; en?: string }>= [
  { key: 'mk1', rarity: 'common', ko: '', en: '' },
  { key: 'mk2', rarity: 'uncommon', ko: '개량형', en: 'Mk.II' },
  { key: 'reinforced', rarity: 'rare', ko: '강화형', en: 'Reinforced' },
  { key: 'elite', rarity: 'epic', ko: '정예형', en: 'Elite' },
  { key: 'relic', rarity: 'legendary', ko: '유물', en: 'Relic' },
];

function title(koParts: string[], enParts: string[]) {
  const ko = koParts.filter(Boolean).join(' ');
  const en = enParts.filter(Boolean).join(' ');
  return { ko, en };
}

function makeId(slot: Slot, fam: string, variant: string, grade: string) {
  return `${slot}_${fam}_${variant}_${grade}`.toLowerCase();
}

export function generateEquipment(maxCount = 300): ItemDef[] {
  const out: ItemDef[] = [];
  // Distribute roughly across slots
  const perSlotTarget: Record<Slot, number> = { head: 50, body: 60, mainhand: 100, offhand: 45, accessory: 45 };
  const counter: Record<Slot, number> = { head: 0, body: 0, mainhand: 0, offhand: 0, accessory: 0 };

  for (const fam of FAMILIES) {
    for (const v of VARIANTS) {
      for (const g of GRADES) {
        if (counter[fam.slot] >= perSlotTarget[fam.slot]) continue;
        const id = makeId(fam.slot, fam.key, v.key, g.key);
        const { ko, en } = title([v.ko, fam.ko, g.ko || ''], [v.en, fam.en, g.en || '']);
        const def: ItemDef = {
          id,
          category: 'equipment',
          slot: fam.slot,
          names: [ { locale: 'ko', text: ko.trim() }, { locale: 'en', text: en.trim() } ],
          synonyms: [fam.ko, fam.en.toLowerCase(), v.ko, v.en.toLowerCase()].filter(Boolean),
          tags: [...v.tags, 'equipment', fam.key],
          rarity: g.rarity
        };
        out.push(def);
        counter[fam.slot] += 1;
        if (out.length >= maxCount) return out;
      }
    }
  }
  return out.slice(0, maxCount);
}

export const GREYFALL_EXPANDED_EQUIPMENT: ItemDef[] = generateEquipment(300);

