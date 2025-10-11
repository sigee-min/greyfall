import { defineKeyedListNetObject } from './registry.js';
import { ACTORS_META_OBJECT_ID } from './object-ids.js';

export type ActorMeta = {
  id: string;
  kind: 'player' | 'npc';
  profileId?: string;
  faction?: string;
  isEnemy?: boolean;
};

export const actorsMeta = defineKeyedListNetObject<ActorMeta>({
  id: ACTORS_META_OBJECT_ID,
  host: { initContext: 'actors:meta:init' },
  client: { requestOnStart: true, requestContext: 'request actors meta' }
});

