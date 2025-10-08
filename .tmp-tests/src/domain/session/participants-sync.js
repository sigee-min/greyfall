import { makeParticipantsSnapshot, isParticipantsSnapshot, PARTICIPANTS_OBJECT_ID } from '../net-objects/participants.js';
import { defineSyncModel, registerSyncModel, useSyncModel } from '../net-objects/index.js';
import { ClientParticipantsObject } from '../net-objects/participants-client.js';
const participantsModel = defineSyncModel({
    id: PARTICIPANTS_OBJECT_ID,
    initial: () => makeParticipantsSnapshot([], 4),
    serialize: (data) => data,
    deserialize: (value) => (isParticipantsSnapshot(value) ? value : null),
    requestOnStart: true,
    incrementalMax: 8,
    // On the client, drive LobbyStore directly via custom adapter
    clientFactory: (deps) => new ClientParticipantsObject(deps.lobbyStore)
});
export const participantsSync = registerSyncModel(participantsModel);
export const participantsHost = participantsSync.host;
export function useParticipantsSnapshot(selector) {
    return useSyncModel(participantsSync, selector);
}
export function publishParticipantsSnapshot(lobbyStore, context = 'participants:sync') {
    const snapshot = makeParticipantsSnapshot(lobbyStore.snapshotWire(), 4);
    participantsHost.set(snapshot, context);
}
