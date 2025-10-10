export type SetLocale = 'ko' | 'en';

import type { EffectSpec } from './effect-types';

export type SetMeta = {
  id: string;
  name: { ko: string; en: string };
  tiers: Record<2 | 4 | 6, { ko: string; en: string }>;
  effects: Record<2 | 4 | 6, EffectSpec[]>;
};

// Minimal demo catalog; extend as needed.
const CATALOG: Record<string, SetMeta> = {
  vanguard: {
    id: 'vanguard',
    name: { ko: '선봉대', en: 'Vanguard' },
    tiers: {
      2: { ko: '타격 저항 +10%', en: 'Blunt Res +10%' },
      4: { ko: '힘 +1', en: 'Strength +1' },
      6: { ko: '관통 저항 +10%', en: 'Pierce Res +10%' }
    },
    effects: {
      2: [{ kind: 'RESIST', target: 'blunt', value: 10 }],
      4: [{ kind: 'STAT', target: 'Strength', op: 'add', value: 1 }],
      6: [{ kind: 'RESIST', target: 'pierce', value: 10 }]
    }
  },
  arcane: {
    id: 'arcane',
    name: { ko: '비전', en: 'Arcane' },
    tiers: {
      2: { ko: '에너지 저항 +10%', en: 'Energy Res +10%' },
      4: { ko: '공학 +1', en: 'Engineering +1' },
      6: { ko: '상태: 집중', en: 'Status: Focused' }
    },
    effects: {
      2: [{ kind: 'RESIST', target: 'energy', value: 10 }],
      4: [{ kind: 'STAT', target: 'Engineering', op: 'add', value: 1 }],
      6: [{ kind: 'STATUS', target: 'Focused', value: 1 }]
    }
  }
};

export function getSetName(id: string, locale: SetLocale): string {
  const meta = CATALOG[id];
  if (!meta) return id;
  return meta.name[locale] || meta.name.en || id;
}

export function getSetTierDesc(id: string, tier: 2 | 4 | 6, locale: SetLocale): string | null {
  const meta = CATALOG[id];
  if (!meta) return null;
  const entry = meta.tiers[tier];
  return entry ? (entry[locale] || entry.en) : null;
}

export function hasSetMeta(id: string): boolean { return Boolean(CATALOG[id]); }

export function getSetTierEffects(id: string, tier: 2 | 4 | 6): EffectSpec[] {
  const meta = CATALOG[id];
  if (!meta) return [];
  return meta.effects[tier] ?? [];
}
