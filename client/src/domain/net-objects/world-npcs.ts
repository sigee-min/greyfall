import { defineKeyedListNetObject } from './registry.js';
import { WORLD_NPCS_OBJECT_ID } from './object-ids.js';

export type NpcPublicEntry = {
  id: string;
  name: string;
  kind: 'civilian' | 'ally' | 'enemy' | 'boss';
  faction: string;
  stance: 'idle' | 'patrol' | 'engage' | 'flee' | 'dead';
  mood: 'calm' | 'tense' | 'angry' | 'afraid';
  hp?: { cur: number; max: number };
};

export const worldNpcs = defineKeyedListNetObject<NpcPublicEntry>({
  id: WORLD_NPCS_OBJECT_ID,
  path: 'list',
  host: { initContext: 'world:npcs:init' },
  client: { requestOnStart: true, requestContext: 'request world npcs' }
});

