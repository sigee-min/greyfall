import type { ParticipantsSnapshot } from '../net-objects/participants.js';
import { makeParticipantsSnapshot, isParticipantsSnapshot, PARTICIPANTS_OBJECT_ID } from '../net-objects/participants.js';
import { defineSyncModel, registerSyncModel, useSyncModel } from '../net-objects/index.js';
import { ClientParticipantsObject } from '../net-objects/participants-client.js';
import { getHostObject } from '../net-objects/registry.js';
import { HostWorldPositionsObject } from '../net-objects/world-positions-host.js';
import { HostPartyObject } from '../net-objects/party-host.js';
import { WORLD_POSITIONS_OBJECT_ID, PARTY_OBJECT_ID } from '../net-objects/object-ids.js';
import { getLimiter } from '../net-objects/policies.js';
import { removeCharacterLoadout } from '../character/character-sync.js';
import type { LobbyStore } from './session-store.js';

const readyLimiter = getLimiter('ready');

const participantsModel = defineSyncModel<ParticipantsSnapshot>({
  id: PARTICIPANTS_OBJECT_ID,
  initial: () => makeParticipantsSnapshot([], 4),
  serialize: (data) => data,
  deserialize: (value) => (isParticipantsSnapshot(value) ? value : null),
  requestOnStart: true,
  incrementalMax: 8,
  // On the client, drive LobbyStore directly via custom adapter
  clientFactory: (deps) => new ClientParticipantsObject(deps.lobbyStore),
  commands: [
    {
      kind: 'hello',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const p = (body as any).participant;
        if (!p || typeof p !== 'object') return null;
        const { id, name, tag, ready, role, avatarUrl } = p as any;
        if (typeof id !== 'string' || typeof name !== 'string' || typeof tag !== 'string') return null;
        if (typeof ready !== 'boolean' || (role !== 'host' && role !== 'guest')) return null;
        const out: any = { id, name, tag, ready, role };
        if (avatarUrl && typeof avatarUrl === 'string') out.avatarUrl = avatarUrl;
        return out;
      },
      handle: ({ payload, context }) => {
        // Update host lobby store and broadcast
        context.lobbyStore.upsertFromWire(payload as any);
        publishParticipantsSnapshot(context.lobbyStore, 'participants:hello');
        // Side-effects: world/party bookkeeping
        const world = getHostObject<HostWorldPositionsObject>(WORLD_POSITIONS_OBJECT_ID);
        if (world) world.ensureParticipant(payload.id, 'LUMENFORD');
        const party = getHostObject<HostPartyObject>(PARTY_OBJECT_ID);
        if (party) party.addMember(payload.id);
      }
    },
    {
      kind: 'ready',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { participantId, ready } = body as any;
        if (typeof participantId !== 'string' || typeof ready !== 'boolean') return null;
        return { participantId, ready };
      },
      handle: ({ payload, context }) => {
        const { participantId, ready } = payload as any;
        if (!readyLimiter.allow(`ready:${participantId}`)) {
          console.warn('[ready] rate limited', { participantId });
          return;
        }
        const raw = context.lobbyStore.snapshotWire().map((p) => (p.id === participantId ? { ...p, ready } : p));
        context.lobbyStore.replaceFromWire(raw);
        publishParticipantsSnapshot(context.lobbyStore, 'participants:ready');
      }
    },
    {
      kind: 'leave',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { participantId } = body as any;
        return typeof participantId === 'string' ? participantId : null;
      },
      handle: ({ payload, context }) => {
        const id = payload as any as string;
        context.lobbyStore.remove(id);
        publishParticipantsSnapshot(context.lobbyStore, 'participants:leave');
        // Side-effects: world/party/character cleanup
        const party = getHostObject<HostPartyObject>(PARTY_OBJECT_ID);
        if (party) party.removeMember(id);
        removeCharacterLoadout(id, 'character:leave');
      }
    }
  ]
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
