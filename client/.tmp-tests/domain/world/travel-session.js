import { defineSyncModel, registerSyncModel, useSyncModel } from '../net-objects/index.js';
const initialTravel = {
    inviteId: null,
    targetMapId: null,
    status: 'idle',
    quorum: 'majority',
    total: 0,
    yes: 0,
    no: 0,
    deadlineAt: null
};
const travelModel = defineSyncModel({
    id: 'world:travel',
    initial: () => ({ ...initialTravel }),
    serialize: (d) => d,
    deserialize: (v) => (isTravelSession(v) ? v : null),
    requestOnStart: true,
    incrementalMax: 16
});
export const travelSync = registerSyncModel(travelModel);
export function useTravelSession(selector) {
    return useSyncModel(travelSync, selector);
}
function isTravelSession(v) {
    if (!v || typeof v !== 'object')
        return false;
    const o = v;
    return ((o.inviteId === null || typeof o.inviteId === 'string') &&
        (o.targetMapId === null || typeof o.targetMapId === 'string') &&
        (o.status === 'idle' || o.status === 'proposed' || o.status === 'approved' || o.status === 'rejected' || o.status === 'cancelled') &&
        (o.quorum === 'majority' || o.quorum === 'all') &&
        typeof o.total === 'number' &&
        typeof o.yes === 'number' &&
        typeof o.no === 'number' &&
        (o.deadlineAt === null || typeof o.deadlineAt === 'number'));
}
