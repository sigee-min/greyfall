import { defineSyncModel, registerSyncModel, useSyncModel } from '../net-objects/index.js';
const model = defineSyncModel({
    id: 'interact:sessions',
    initial: () => ({ invites: [] }),
    serialize: (d) => d,
    deserialize: (v) => (isInteractionsState(v) ? v : null),
    requestOnStart: true,
    incrementalMax: 32
});
export const interactionsSync = registerSyncModel(model);
export function useInteractionsState(selector) {
    return useSyncModel(interactionsSync, selector);
}
function isInteractionsState(v) {
    if (!v || typeof v !== 'object')
        return false;
    const o = v;
    if (!Array.isArray(o.invites))
        return false;
    return true;
}
