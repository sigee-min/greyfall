import type { ParticipantsSnapshot } from '../net-objects/participants.js';
import { makeParticipantsSnapshot, isParticipantsSnapshot, PARTICIPANTS_OBJECT_ID } from '../net-objects/participants.js';
import { defineSyncModel, registerSyncModel, useSyncModel } from '../net-objects/index.js';
import { ClientParticipantsObject } from '../net-objects/participants-client.js';
import type { LobbyStore } from './session-store.js';

const participantsModel = defineSyncModel<ParticipantsSnapshot>({
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

export function useParticipantsSnapshot<T = ParticipantsSnapshot>(selector?: (snapshot: ParticipantsSnapshot) => T): T {
  return useSyncModel(participantsSync, selector);
}

export function publishParticipantsSnapshot(lobbyStore: LobbyStore, context = 'participants:sync') {
  const snapshot = makeParticipantsSnapshot(lobbyStore.snapshotWire(), 4);
  participantsHost.set(snapshot, context);
}
