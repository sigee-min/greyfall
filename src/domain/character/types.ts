import type { Passive, StatKey, TraitSpec } from '../../store/character';

export type CharacterLoadout = {
  playerId: string;
  budget: number;
  remaining: number;
  stats: Record<StatKey, number>;
  passives: Passive[];
  traits: TraitSpec[];
  built: boolean;
  updatedAt: number;
};

export type CharacterLoadoutSnapshot = {
  revision: number;
  entries: CharacterLoadout[];
  byId: Record<string, CharacterLoadout>;
};
