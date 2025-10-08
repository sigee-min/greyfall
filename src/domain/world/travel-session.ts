import { defineSyncModel, registerSyncModel, useSyncModel } from '../net-objects/index.js';

export type TravelStatus = 'idle' | 'proposed' | 'approved' | 'rejected' | 'cancelled';
export type TravelQuorum = 'majority' | 'all';

export type TravelSession = {
  inviteId: string | null;
  targetMapId: string | null;
  status: TravelStatus;
  quorum: TravelQuorum;
  total: number;
  yes: number;
  no: number;
  deadlineAt: number | null;
};

const initialTravel: TravelSession = {
  inviteId: null,
  targetMapId: null,
  status: 'idle',
  quorum: 'majority',
  total: 0,
  yes: 0,
  no: 0,
  deadlineAt: null
};

const travelModel = defineSyncModel<TravelSession>({
  id: 'world:travel',
  initial: () => ({ ...initialTravel }),
  serialize: (d) => d,
  deserialize: (v) => (isTravelSession(v) ? (v as TravelSession) : null),
  requestOnStart: true,
  incrementalMax: 16
});

export const travelSync = registerSyncModel(travelModel);

export function useTravelSession<T = TravelSession>(selector?: (d: TravelSession) => T): T {
  return useSyncModel(travelSync, selector);
}

function isTravelSession(v: unknown): v is TravelSession {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    (o.inviteId === null || typeof o.inviteId === 'string') &&
    (o.targetMapId === null || typeof o.targetMapId === 'string') &&
    (o.status === 'idle' || o.status === 'proposed' || o.status === 'approved' || o.status === 'rejected' || o.status === 'cancelled') &&
    (o.quorum === 'majority' || o.quorum === 'all') &&
    typeof o.total === 'number' &&
    typeof o.yes === 'number' &&
    typeof o.no === 'number' &&
    (o.deadlineAt === null || typeof o.deadlineAt === 'number')
  );
}

