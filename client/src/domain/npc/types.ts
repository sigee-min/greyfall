import type { StatKey } from '../stats/keys';

export type NpcKind = 'civilian' | 'ally' | 'enemy' | 'boss';

export type Ability = {
  id: string;
  name: string;
  kind: 'attack' | 'defend' | 'utility';
  power: number;
  cost?: number;
  cooldownMs: number;
  tags?: string[];
};

export type LootEntry = { itemKey: string; weight: number; min: number; max: number };

export type NpcProfile = {
  id: string;
  name: string;
  kind: NpcKind;
  faction: string;
  baseStats: Record<StatKey, number>;
  abilities: Ability[];
  lootTable: LootEntry[];
  persona: { style: string; goals: string[]; taboo: string[]; tags: string[] };
};

export type NpcState = {
  hp: { cur: number; max: number };
  stance: 'idle' | 'patrol' | 'engage' | 'flee' | 'dead';
  mood: 'calm' | 'tense' | 'angry' | 'afraid';
  status: string[];
  cooldowns: Record<string, number>; // abilityId → remaining ms
  aggro: Record<string, number>; // actorId → threat
};

export type Relationship = { affinity: number; trust: number; tension: number; lastEvent?: string };

export type MemoryEntry = { id: string; kind: 'fact' | 'trait' | 'event'; content: string; salience: number; lastUsedAt?: number };

export type NpcMemory = {
  shortTerm: string; // compressed summary
  longTerm: MemoryEntry[];
  relationships: Record<string, Relationship>;
};

export type NpcAction =
  | { type: 'emote'; npcId: string; kind: string }
  | { type: 'move'; npcId: string; to: { mapId: string; fieldId: string } }
  | { type: 'attack'; npcId: string; targetId: string; mode?: 'melee' | 'ranged' | 'ability'; abilityId?: string; power?: number }
  | { type: 'give'; npcId: string; itemKey: string; toId: string; count?: number }
  | { type: 'loot'; npcId: string; fromId: string; items?: Array<{ key: string; count: number }> }
  | { type: 'set_flag'; npcId: string; key: string; value: unknown }
  | { type: 'change_stance'; npcId: string; stance: NpcState['stance'] };

