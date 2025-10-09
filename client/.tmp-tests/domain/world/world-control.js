import { defineSyncModel, registerSyncModel } from '../net-objects/index.js';
import { getHostObject } from '../net-objects/registry.js';
import { WORLD_POSITIONS_OBJECT_ID } from '../net-objects/object-ids.js';
import { getLimiter } from '../net-objects/policies.js';
const moveLimiter = getLimiter('move');
const worldControl = defineSyncModel({
    id: 'world:control',
    initial: () => null,
    requestOnStart: false,
    commands: [
        {
            kind: 'field:move:request',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { playerId, mapId, fromFieldId, toFieldId } = body;
                if (typeof playerId !== 'string' ||
                    typeof mapId !== 'string' ||
                    typeof fromFieldId !== 'string' ||
                    typeof toFieldId !== 'string')
                    return null;
                return { playerId, mapId, fromFieldId, toFieldId };
            },
            handle: ({ payload, context }) => {
                const { playerId, mapId, fromFieldId, toFieldId } = payload;
                if (!moveLimiter.allow(`move:${playerId}`)) {
                    console.warn('[move] rate limited', { playerId });
                    return;
                }
                const exists = context.lobbyStore.participantsRef.current.some((p) => p.id === playerId);
                if (!exists)
                    return;
                const world = getHostObject(WORLD_POSITIONS_OBJECT_ID);
                if (!world)
                    return;
                const ok = world.moveField(playerId, mapId, fromFieldId, toFieldId);
                if (!ok)
                    console.warn('[move] rejected', { playerId, mapId, fromFieldId, toFieldId });
            }
        }
    ]
});
registerSyncModel(worldControl);
