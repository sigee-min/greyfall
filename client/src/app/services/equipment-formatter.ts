import type { EffectSpec, SetsProgress } from '../../domain/equipment/effect-types';
import { getSetName } from '../../domain/equipment/sets-catalog';
import type { StatKey } from '../../domain/stats/keys';

export function formatEffect(spec: EffectSpec, locale: 'ko' | 'en' = 'ko'): string {
  switch (spec.kind) {
    case 'STAT': {
      const v = typeof spec.value === 'number' ? spec.value : 0;
      const sign = v >= 0 ? '+' : '';
      return `${tStat(spec.target as string, locale)} ${sign}${v}`;
    }
    case 'RESIST': {
      const v = typeof spec.value === 'number' ? spec.value : 0;
      const sign = v >= 0 ? '+' : '';
      return `${tResist(spec.target as string, locale)} ${sign}${v}%`;
    }
    case 'STATUS': {
      return `${tStatus(spec.target as string, locale)}`;
    }
    case 'TAG': {
      return `#${String((spec.tags ?? [])[0] ?? 'tag')}`;
    }
    case 'SET':
    default:
      return '—';
  }
}

export function formatDerived(derived: Partial<Record<StatKey, number>>, locale: 'ko' | 'en' = 'ko'): string {
  const pairs: Array<[StatKey, string, string]> = [
    ['Strength', 'STR', '힘'],
    ['Agility', 'AGI', '민첩'],
    ['Engineering', 'ENG', '공학'],
    ['Dexterity', 'DEX', '기교'],
    ['Medicine', 'MED', '의학']
  ];
  return pairs
    .map(([k, en, ko]) => (k in derived ? `${locale === 'ko' ? ko : en} ${derived[k]}` : null))
    .filter(Boolean)
    .join(' • ');
}

export function formatResists(resists: Record<string, number>, locale: 'ko' | 'en' = 'ko'): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(resists)) {
    const sign = v >= 0 ? '+' : '';
    parts.push(`${tResist(k, locale)} ${sign}${v}%`);
  }
  return parts.join(' / ');
}

export function formatSetsProgress(list: SetsProgress[], locale: 'ko' | 'en' = 'ko'): string {
  if (!Array.isArray(list) || list.length === 0) return '';
  const parts: string[] = [];
  for (const sp of list) {
    const name = getSetName(sp.setId, locale);
    const achievedCount = sp.achieved.length;
    const dots = `${'●'.repeat(achievedCount)}${'○'.repeat(Math.max(0, 3 - achievedCount))}`;
    const hint = typeof sp.nextTier === 'number' ? (locale === 'ko' ? `→ ${sp.nextTier}` : `→ ${sp.nextTier}`) : '';
    parts.push(`${name} ${dots}${hint ? ' ' + hint : ''}`);
  }
  const label = locale === 'ko' ? '세트' : 'Sets';
  return `${label} ${parts.join(' / ')}`;
}

export function reasonToMessageKey(reason: string): string {
  switch (reason) {
    case 'slot-capacity': return 'equip.reason.slotCapacity';
    case 'combat-restricted': return 'equip.reason.combatRestricted';
    case 'unavailable': return 'equip.reason.unavailable';
    case 'cooldown': return 'equip.reason.cooldown';
    case 'unauthorized': return 'equip.reason.unauthorized';
    case 'duplicate': return 'equip.reason.duplicate';
    case 'publish-failed': return 'equip.reason.publishFailed';
    default: return 'equip.reason.unknown';
  }
}

function tStat(key: string, locale: 'ko' | 'en'): string {
  const map: Record<string, string> = locale === 'ko'
    ? { Strength: '힘', Agility: '민첩', Engineering: '공학', Dexterity: '기교', Medicine: '의학' }
    : { Strength: 'Strength', Agility: 'Agility', Engineering: 'Engineering', Dexterity: 'Dexterity', Medicine: 'Medicine' };
  return map[key] ?? key;
}

function tResist(key: string, locale: 'ko' | 'en'): string {
  const map: Record<string, string> = locale === 'ko'
    ? { pierce: '관통 저항', blunt: '타격 저항', energy: '에너지 저항' }
    : { pierce: 'Pierce Res', blunt: 'Blunt Res', energy: 'Energy Res' };
  return map[key] ?? key;
}

function tStatus(key: string, locale: 'ko' | 'en'): string {
  const map: Record<string, string> = locale === 'ko' ? {} : {};
  return map[key] ?? key;
}
