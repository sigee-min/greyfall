import type { StatKey } from '../stats/keys';
import { defineValueNetObject } from '../net-objects/registry.js';

export type BaseStatsMap = Record<string, Record<StatKey, number>>; // actorId → base stats

export const npcBaseStats = defineValueNetObject<BaseStatsMap>({
  id: 'npc:base-stats',
  initial: {},
  host: { initContext: 'npc:base-stats:init' },
  client: { requestOnStart: false }
});

