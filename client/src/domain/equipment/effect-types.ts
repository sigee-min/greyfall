import type { StatKey, StatusKey, ResistKey } from '../stats/keys';

export type EffectKind = 'STAT' | 'STATUS' | 'RESIST' | 'SET' | 'TAG';

export type EffectSpec = {
  kind: EffectKind;
  target?: StatKey | StatusKey | ResistKey | string;
  op?: 'add' | 'mul';
  value: number | string | Record<string, number>;
  setId?: string;
  setTier?: 2 | 4 | 6;
  priority?: number;
  tags?: string[];
};

export type StatMods = Record<StatKey, { add: number; mul: number }>;

export type Modifiers = {
  stats: StatMods;
  statuses: string[];
  resists: Record<string, number>;
  tags: string[];
};

export type EquipmentAggregationInput = {
  base: Record<StatKey, number>;
  equipped: string[];
  effectsByItem: Record<string, EffectSpec[]>;
  rulesVersion?: string;
};

export type EquipmentAggregationResult = {
  modifiers: Modifiers;
  derived?: Partial<Record<StatKey, number>>;
  effectsHash: string;
  trace?: Array<{ itemKey: string; effectIndex: number }>;
  setsProgress?: SetsProgress[];
};

export type SetsProgress = {
  setId: string;
  count: number;
  tiers: number[];
  achieved: number[];
  nextTier?: number;
};
