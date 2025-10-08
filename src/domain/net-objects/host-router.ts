import { parseLobbyMessage, type LobbyMessage } from '../../protocol/index.js';
import type { LobbyStore } from '../session/session-store';
import type { CommonDeps, HostObject } from './types';
import { CHAT_OBJECT_ID } from './chat.js';
import { WORLD_POSITIONS_OBJECT_ID } from './world-positions-host.js';
// LLM progress net-object removed
import { PARTY_OBJECT_ID } from './party-host.js';
import { getEntryField, getMap } from '../world/nav';
import { SlidingWindowLimiter } from './rate-limit.js';
import { PeerParticipantMap } from './peer-map.js';
import type { NetObjectDescriptor } from './registry.js';
import { dispatchSyncModelCommand } from './sync-model.js';
import { removeCharacterLoadout } from '../character/character-sync.js';
import { publishParticipantsSnapshot } from '../session/participants-sync.js';

// Local minimal interfaces to decouple from concrete classes
type HostChatApi = {
  id: string;
  append: (entry: any, context?: string) => void;
  onRequest: (sinceRev?: number) => boolean;
};

type HostWorldPositionsApi = {
  id: string;
  ensureParticipant: (participantId: string, mapId: string) => boolean;
  movePartyToMap: (mapId: string, memberIds: string[]) => boolean;
  moveField: (playerId: string, mapId: string, fromFieldId: string, toFieldId: string) => boolean;
  onRequest: (sinceRev?: number) => boolean;
};

type HostPartyApi = {
  id: string;
  addMember: (id: string) => boolean;
  removeMember: (id: string) => boolean;
  getMembers: () => string[];
  travel: (direction?: 'next' | 'prev', toMapId?: string) => boolean;
  onRequest: (sinceRev?: number) => boolean;
};

type Publish = (message: LobbyMessage) => void;
type Send = <K extends LobbyMessage['kind']>(kind: K, body: Extract<LobbyMessage, { kind: K }>['body'], context?: string) => boolean;

export class HostRouter {
  private readonly send: Send;
  private readonly lobbyStore: LobbyStore;
  private readonly publishToBus: Publish;
  private readonly descriptors: NetObjectDescriptor[];
  private readonly commonDeps: CommonDeps;
  private readonly objects: Map<string, HostObject>;
  private readonly chat: HostChatApi;
  private readonly world: HostWorldPositionsApi;
  private readonly party: HostPartyApi;
  // private readonly llm: HostLlmProgressObject;
  private readonly limiter: SlidingWindowLimiter;
  private readonly onAck?: (peerId: string | undefined, id: string, rev: number) => void;
  private readonly map = new PeerParticipantMap();
  private readonly registry = new Map<string, HostObject>();
  private travelPoll: {
    inviteId: string;
    targetMapId: string;
    quorum: 'majority' | 'all';
    votes: Map<string, boolean | undefined>;
  } | null = null;
  private travelPollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(args: {
    send: Send;
    lobbyStore: LobbyStore;
    publishToBus: Publish;
    descriptors: NetObjectDescriptor[];
    objects: Map<string, HostObject>;
    commonDeps: CommonDeps;
    limiter?: SlidingWindowLimiter;
    onAck?: (peerId: string | undefined, id: string, rev: number) => void;
  }) {
    this.send = args.send;
    this.lobbyStore = args.lobbyStore;
    this.publishToBus = args.publishToBus;
    this.descriptors = [...args.descriptors];
    this.commonDeps = args.commonDeps;
    this.objects = args.objects;
    this.limiter = args.limiter ?? new SlidingWindowLimiter(5, 10_000);
    this.onAck = args.onAck;
    for (const object of this.objects.values()) {
      this.register(object);
    }
    this.chat = this.require<HostChatApi>(CHAT_OBJECT_ID);
    // LLM progress removed
    this.world = this.require<HostWorldPositionsApi>(WORLD_POSITIONS_OBJECT_ID);
    this.party = this.require<HostPartyApi>(PARTY_OBJECT_ID);
  }

  register(object: HostObject) {
    this.registry.set(object.id, object);
    if (!this.objects.has(object.id)) {
      this.objects.set(object.id, object);
    }
  }

  addNetObject(descriptor: NetObjectDescriptor, object: HostObject) {
    if (!this.descriptors.some((entry) => entry.id === descriptor.id)) {
      this.descriptors.push(descriptor);
    }
    this.register(object);
  }

  private require<T extends HostObject>(id: string): T {
    const object = this.registry.get(id);
    if (!object) {
      throw new Error(`HostRouter missing host object "${id}"`);
    }
    return object as T;
  }

  onPeerConnected(_peerId: string) {
    for (const descriptor of this.descriptors) {
      const object = this.registry.get(descriptor.id);
      if (!object) continue;
      if (descriptor.host.onPeerConnect) {
        descriptor.host.onPeerConnect(object, this.commonDeps);
      }
    }
  }

  onPeerDisconnected(peerId: string) {
    const participantId = this.map.getParticipant(peerId);
    if (!participantId) return;
    this.map.removeByPeer(peerId);
    this.lobbyStore.remove(participantId);
    publishParticipantsSnapshot(this.lobbyStore, 'participants:peer-disconnect');
    removeCharacterLoadout(participantId, 'character:peer-disconnect');
  }

  updateParticipantReady(participantId: string, ready: boolean, context = 'ready:host-toggle') {
    const raw = this.lobbyStore.snapshotWire().map((p) => (p.id === participantId ? { ...p, ready } : p));
    this.lobbyStore.replaceFromWire(raw);
    publishParticipantsSnapshot(this.lobbyStore, context);
  }

  handle(payload: unknown, peerId?: string) {
    const message = parseLobbyMessage(payload);
    if (!message) return;
    const senderId = peerId ? this.map.getParticipant(peerId) : this.lobbyStore.localParticipantIdRef.current;
    if (dispatchSyncModelCommand(message, { peerId, senderId, lobbyStore: this.lobbyStore, router: this })) {
      return;
    }
    try {
      switch (message.kind) {
        case 'object:request': {
          const { id, sinceRev } = message.body;
          if (peerId && !this.limiter.allow(`request:${peerId}:${id}`)) {
            console.warn('[object:request] rate limited', { peerId, id });
            break;
          }
          this.registry.get(id)?.onRequest(sinceRev);
          break;
        }
        // field:move:request handled by world:control command
        case 'map:travel:request': {
          const { requesterId, direction, toMapId } = message.body as any;
          if (!this.limiter.allow(`travel:${requesterId}`)) {
            console.warn('[travel] rate limited', { requesterId });
            break;
          }
          // Validate all current party members are on the same map at its entry field
          const members = this.party.getMembers();
          if (members.length === 0) break;
          const posState = (this.world as any).replicator?.get?.('world:positions')?.value as any;
          const list: { id: string; mapId: string; fieldId: string }[] = Array.isArray(posState?.list) ? posState.list : [];
          const first = list.find((e) => e.id === members[0]);
          if (!first) break;
          const map = getMap(first.mapId);
          if (!map) break;
          const entry = getEntryField(map);
          const allOnSameMap = members.every((m: string) => {
            const p = list.find((e) => e.id === m);
            return p && p.mapId === first.mapId && p.fieldId === (entry?.id ?? '');
          });
          if (!allOnSameMap) {
            console.warn('[travel] denied: not all at entry', { firstMap: first.mapId });
            break;
          }
          const ok = this.party.travel(direction as any, toMapId as any);
          if (!ok) console.warn('[travel] failed', { direction, toMapId });
          break;
        }
        case 'map:travel:propose': {
          const { requesterId, direction, toMapId, quorum } = message.body as any;
          if (!this.limiter.allow(`travel:${requesterId}`)) {
            console.warn('[travel] rate limited', { requesterId });
            break;
          }
          if (this.travelPoll) {
            console.warn('[travel] already in progress');
            break;
          }
          // Validate preconditions (all members at entry of current map)
          const members = this.party.getMembers();
          if (members.length === 0) break;
          const posState = (this.world as any).replicator?.get?.('world:positions')?.value as any;
          const list: { id: string; mapId: string; fieldId: string }[] = Array.isArray(posState?.list) ? posState.list : [];
          const first = list.find((e) => e.id === members[0]);
          if (!first) break;
          const map = getMap(first.mapId);
          if (!map) break;
          const entry = getEntryField(map);
          const allOnSameMap = members.every((m: string) => {
            const p = list.find((e) => e.id === m);
            return p && p.mapId === first.mapId && p.fieldId === (entry?.id ?? '');
          });
          if (!allOnSameMap) {
            console.warn('[travel] denied: not all at entry', { firstMap: first.mapId });
            break;
          }
          let targetId = String(toMapId ?? '');
          if (!targetId && direction) {
            targetId = direction === 'next' ? (map.next ?? map.id) : (map.prev ?? map.id);
          }
          if (!targetId || targetId === map.id) break;
          const inviteId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
          const votes = new Map<string, boolean | undefined>();
          for (const m of members) votes.set(m, undefined);
          votes.set(String(requesterId), true);
          // Use requested quorum if provided; default to majority
          const q: 'majority' | 'all' = (quorum === 'all' ? 'all' : 'majority');
          this.travelPoll = { inviteId, targetMapId: targetId, quorum: q, votes };
          const { yes, no, total } = this.computeVoteCounts();
          this.send('map:travel:update' as any, { inviteId, status: 'proposed', targetMapId: targetId, yes, no, total, quorum: q } as any, 'travel:update');
          // Start timeout (1 minute)
          if (this.travelPollTimer) {
            clearTimeout(this.travelPollTimer);
            this.travelPollTimer = null;
          }
          this.travelPollTimer = setTimeout(() => {
            if (!this.travelPoll) return;
            // On timeout, if not approved, reject
            const status = this.evaluateTravelVote();
            const { yes, no, total } = this.computeVoteCounts();
            if (status === 'approved') {
              const succeeded = this.party.travel(undefined as any, this.travelPoll.targetMapId);
              if (!succeeded) {
                this.send('map:travel:update' as any, { inviteId, status: 'rejected', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
                this.travelPoll = null;
                if (this.travelPollTimer) {
                  clearTimeout(this.travelPollTimer);
                  this.travelPollTimer = null;
                }
                return;
              }
              this.send('map:travel:update' as any, { inviteId, status: 'approved', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
            } else {
              this.send('map:travel:update' as any, { inviteId, status: 'rejected', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
            }
            this.travelPoll = null;
            if (this.travelPollTimer) {
              clearTimeout(this.travelPollTimer);
              this.travelPollTimer = null;
            }
          }, 60_000);
          break;
        }
        case 'map:travel:vote': {
          if (!this.travelPoll) break;
          const { inviteId, voterId, approve } = message.body as any;
          if (inviteId !== this.travelPoll.inviteId) break;
          if (!this.travelPoll.votes.has(String(voterId))) break;
          this.travelPoll.votes.set(String(voterId), Boolean(approve));
          const status = this.evaluateTravelVote();
          if (status === 'pending') {
            const { yes, no, total } = this.computeVoteCounts();
            this.send('map:travel:update' as any, { inviteId, status: 'proposed', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
          } else if (status === 'approved') {
            // Execute travel
            const succeeded = this.party.travel(undefined as any, this.travelPoll.targetMapId);
            const { yes, no, total } = this.computeVoteCounts();
            if (!succeeded) {
              this.send('map:travel:update' as any, { inviteId, status: 'rejected', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
            } else {
              this.send('map:travel:update' as any, { inviteId, status: 'approved', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
            }
            this.travelPoll = null;
            if (this.travelPollTimer) {
              clearTimeout(this.travelPollTimer);
              this.travelPollTimer = null;
            }
          } else if (status === 'rejected') {
            const { yes, no, total } = this.computeVoteCounts();
            this.send('map:travel:update' as any, { inviteId, status: 'rejected', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
            this.travelPoll = null;
            if (this.travelPollTimer) {
              clearTimeout(this.travelPollTimer);
              this.travelPollTimer = null;
            }
          }
          break;
        }
        case 'map:travel:cancel': {
          if (!this.travelPoll) break;
          const { inviteId, byId } = message.body as any;
          if (inviteId !== this.travelPoll.inviteId) break;
          // Only host can cancel
          const isHost = this.lobbyStore.participantsRef.current.some((p) => p.id === String(byId) && p.role === 'host');
          if (!isHost) break;
          const { yes, no, total } = this.computeVoteCounts();
          this.send('map:travel:update' as any, { inviteId, status: 'cancelled', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
          this.travelPoll = null;
          if (this.travelPollTimer) {
            clearTimeout(this.travelPollTimer);
            this.travelPollTimer = null;
          }
          break;
        }
        case 'interact:invite': {
          const { inviteId, fromId, toId, mapId, fieldId, verb } = message.body as any;
          // Validate same field
          const posState = (this.world as any).replicator?.get?.('world:positions')?.value as any;
          const list: any[] = Array.isArray(posState?.list) ? posState.list : [];
          const pf = list.find((e) => e.id === fromId);
          const pt = list.find((e) => e.id === toId);
          if (!pf || !pt) break;
          if (!(pf.mapId === mapId && pt.mapId === mapId && pf.fieldId === fieldId && pt.fieldId === fieldId)) {
            console.warn('[interact] invite rejected: not same field');
            break;
          }
          // Broadcast invite as-is
          this.send('interact:invite' as any, { inviteId, fromId, toId, mapId, fieldId, verb } as any, 'interact:invite');
          break;
        }
        case 'interact:accept': {
          const { inviteId, toId } = message.body as any;
          // No further validation here; in a real system we would check invite store
          this.send('interact:confirmed' as any, { inviteId, fromId: 'unknown', toId, verb: 'unknown' } as any, 'interact:confirmed');
          break;
        }
        case 'interact:cancel': {
          const { inviteId, byId } = message.body as any;
          this.send('interact:cancel' as any, { inviteId, byId } as any, 'interact:cancel');
          break;
        }
        case 'object:ack': {
          const { id, rev } = message.body as any;
          console.debug('[object:ack] recv', { id, rev, peerId });
          this.onAck?.(peerId, String(id), Number(rev));
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error('[host-router] handle failed', { err });
    }
    this.publishToBus(message);
  }

  private computeVoteCounts() {
    const poll = this.travelPoll;
    if (!poll) return { yes: 0, no: 0, total: 0 };
    let yes = 0;
    let no = 0;
    poll.votes.forEach((v) => {
      if (v === true) yes++;
      else if (v === false) no++;
    });
    return { yes, no, total: poll.votes.size };
  }

  private evaluateTravelVote(): 'pending' | 'approved' | 'rejected' {
    const poll = this.travelPoll;
    if (!poll) return 'pending';
    const { yes, no, total } = this.computeVoteCounts();
    if (poll.quorum === 'all') {
      if (yes === total) return 'approved';
      if (no > 0) return 'rejected';
      return 'pending';
    }
    // majority
    const need = Math.floor(total / 2) + 1;
    if (yes >= need) return 'approved';
    if (no > total - need) return 'rejected';
    return 'pending';
  }
}
