import { defineSyncModel, registerSyncModel } from '../net-objects/index.js';
import { getHostObject } from '../net-objects/registry.js';
import { WORLD_ACTORS_OBJECT_ID, WORLD_POSITIONS_OBJECT_ID } from '../net-objects/object-ids.js';
import { HostWorldActorsObject } from '../net-objects/world-actors-host.js';
import { HostWorldPositionsObject } from '../net-objects/world-positions-host.js';

type VoidState = null;

const actorsControl = defineSyncModel<VoidState>({
  id: 'actors:control',
  initial: () => null,
  requestOnStart: false,
  commands: [
    {
      kind: 'actors:hpAdd:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { actorId, delta } = body as { actorId?: unknown; delta?: unknown };
        if (typeof actorId !== 'string') return null;
        const d = typeof delta === 'number' ? Math.max(-20, Math.min(20, Math.floor(delta))) : 0;
        if (!d) return null;
        return { actorId, delta: d };
      },
      handle: ({ payload }) => {
        const { actorId, delta } = payload as { actorId: string; delta: number };
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        actors?.ensure(actorId);
        actors?.hpAdd(actorId, delta);
      }
    },
    {
      kind: 'actors:inventory:transfer:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { fromId, toId, key, count } = body as { fromId?: unknown; toId?: unknown; key?: unknown; count?: unknown };
        if (typeof fromId !== 'string' || typeof toId !== 'string' || typeof key !== 'string') return null;
        const c = typeof count === 'number' ? Math.max(1, Math.min(99, Math.floor(count))) : 1;
        return { fromId, toId, key, count: c };
      },
      handle: ({ payload }) => {
        const { fromId, toId, key, count } = payload as { fromId: string; toId: string; key: string; count: number };
        // Basic validation: same field required
        const positions = getHostObject<HostWorldPositionsObject>(WORLD_POSITIONS_OBJECT_ID);
        const list = positions?.getList() ?? [];
        const pf = list.find((e) => e.id === fromId);
        const pt = list.find((e) => e.id === toId);
        if (!pf || !pt) return;
        if (!(pf.mapId === pt.mapId && pf.fieldId === pt.fieldId)) return;
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        actors?.ensure(fromId);
        actors?.ensure(toId);
        actors?.transferItem(fromId, toId, key, count);
      }
    },
    {
      kind: 'actors:equip:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { actorId, key } = body as { actorId?: unknown; key?: unknown };
        if (typeof actorId !== 'string' || typeof key !== 'string') return null;
        return { actorId, key };
      },
      handle: ({ payload }) => {
        const { actorId, key } = payload as { actorId: string; key: string };
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        actors?.ensure(actorId);
        actors?.equipItem(actorId, key);
      }
    },
    {
      kind: 'actors:unequip:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { actorId, key } = body as { actorId?: unknown; key?: unknown };
        if (typeof actorId !== 'string' || typeof key !== 'string') return null;
        return { actorId, key };
      },
      handle: ({ payload }) => {
        const { actorId, key } = payload as { actorId: string; key: string };
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        actors?.ensure(actorId);
        actors?.unequipItem(actorId, key);
      }
    }
  ]
});

registerSyncModel(actorsControl);
