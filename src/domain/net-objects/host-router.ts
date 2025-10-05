import { parseLobbyMessage, type LobbyMessage } from '../../protocol/index.js';
import type { LobbyStore } from '../session/session-store';
import type { HostObject } from './types';
import { HostParticipantsObject } from './participants-host.js';
import { HostChatObject } from './chat-host.js';
import { HostWorldPositionsObject } from './world-positions-host.js';
import { HostPartyObject } from './party-host.js';
import { WORLD_STATIC } from '../world/data';
import { getEntryField, getMap } from '../world/nav';
import { SlidingWindowLimiter } from './rate-limit.js';
import { PeerParticipantMap } from './peer-map.js';

type Publish = (message: LobbyMessage) => void;
type Send = <K extends LobbyMessage['kind']>(kind: K, body: Extract<LobbyMessage, { kind: K }>['body'], context?: string) => boolean;

export class HostRouter {
  private readonly send: Send;
  private readonly lobbyStore: LobbyStore;
  private readonly publishToBus: Publish;
  private readonly participants: HostParticipantsObject;
  private readonly chat: HostChatObject;
  private readonly world: HostWorldPositionsObject;
  private readonly party: HostPartyObject;
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

  constructor(args: {
    send: Send;
    lobbyStore: LobbyStore;
    publishToBus: Publish;
    participants: HostParticipantsObject;
    chat: HostChatObject;
    limiter?: SlidingWindowLimiter;
    onAck?: (peerId: string | undefined, id: string, rev: number) => void;
  }) {
    this.send = args.send;
    this.lobbyStore = args.lobbyStore;
    this.publishToBus = args.publishToBus;
    this.participants = args.participants;
    this.chat = args.chat;
    this.limiter = args.limiter ?? new SlidingWindowLimiter(5, 10_000);
    this.onAck = args.onAck;
    this.register(this.participants);
    this.register(this.chat);
    this.world = new HostWorldPositionsObject({ publish: (k: any, b: any, c?: string) => this.send(k, b, c), lobbyStore: this.lobbyStore });
    this.register(this.world);
    this.party = new HostPartyObject({ publish: (k: any, b: any, c?: string) => this.send(k, b, c), lobbyStore: this.lobbyStore }, this.world);
    this.register(this.party);
  }

  register(object: HostObject) {
    this.registry.set(object.id, object);
  }

  onPeerConnected(_peerId: string) {
    this.participants.broadcast('peer-connected');
  }

  onPeerDisconnected(peerId: string) {
    const participantId = this.map.getParticipant(peerId);
    if (!participantId) return;
    this.map.removeByPeer(peerId);
    this.lobbyStore.remove(participantId);
    this.participants.remove(participantId, 'peer-disconnected');
  }

  updateParticipantReady(participantId: string, ready: boolean, context = 'ready:host-toggle') {
    const raw = this.lobbyStore.snapshotWire().map((p) => (p.id === participantId ? { ...p, ready } : p));
    this.lobbyStore.replaceFromWire(raw);
    this.participants.update(participantId, { ready }, context);
  }

  handle(payload: unknown, peerId?: string) {
    const message = parseLobbyMessage(payload);
    if (!message) return;
    try {
      switch (message.kind) {
        case 'hello': {
          const p = message.body.participant;
          this.lobbyStore.upsertFromWire(p);
          this.participants.upsert(p, 'hello:merge');
          if (peerId) this.map.set(peerId, p.id);
          // Ensure world position at map head's entry field
          this.world.ensureParticipant(p.id, 'LUMENFORD');
          this.party.addMember(p.id);
          break;
        }
        case 'ready': {
          const { participantId, ready } = message.body;
          if (!this.limiter.allow(`ready:${participantId}`)) {
            console.warn('[ready] rate limited', { participantId });
            break;
          }
          const raw = this.lobbyStore.snapshotWire().map((p) => (p.id === participantId ? { ...p, ready } : p));
          this.lobbyStore.replaceFromWire(raw);
          this.participants.update(participantId, { ready }, 'ready:merge');
          break;
        }
        case 'leave': {
          const id = message.body.participantId;
          this.lobbyStore.remove(id);
          this.participants.remove(id, 'leave:remove');
          this.map.removeByParticipant(id);
          this.party.removeMember(id);
          break;
        }
        case 'object:request': {
          const { id, sinceRev } = message.body;
          if (peerId && !this.limiter.allow(`request:${peerId}:${id}`)) {
            console.warn('[object:request] rate limited', { peerId, id });
            break;
          }
          this.registry.get(id)?.onRequest(sinceRev);
          break;
        }
        case 'chat:append:request': {
          const authorId = String((message.body as any).authorId ?? this.lobbyStore.localParticipantIdRef.current ?? 'host');
          const rawBody = String((message.body as any).body ?? '');
          const trimmed = rawBody.trim();
          if (!trimmed) break;
          if (!this.limiter.allow(`chat:${authorId}`)) {
            console.warn('[chat] rate limited', { authorId });
            break;
          }
          const self = this.lobbyStore.participantsRef.current.find((p) => p.id === authorId);
          this.chat.append(
            {
              id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              authorId,
              authorName: self?.name ?? 'Host',
              authorTag: self?.tag ?? '#HOST',
              authorRole: self?.role ?? 'guest',
              body: trimmed,
              at: Date.now()
            },
            'chat-append'
          );
          break;
        }
        case 'field:move:request': {
          const body = message.body as any;
          const { playerId, mapId, fromFieldId, toFieldId } = body;
          if (!this.limiter.allow(`move:${playerId}`)) {
            console.warn('[move] rate limited', { playerId });
            break;
          }
          // Ensure player exists
          const exists = this.lobbyStore.participantsRef.current.some((p) => p.id === playerId);
          if (!exists) break;
          const ok = this.world.moveField(String(playerId), String(mapId), String(fromFieldId), String(toFieldId));
          if (!ok) console.warn('[move] rejected', { playerId, mapId, fromFieldId, toFieldId });
          break;
        }
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
          const allOnSameMap = members.every((m) => {
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
          const allOnSameMap = members.every((m) => {
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
          const q: 'majority' | 'all' = quorum ?? 'majority';
          this.travelPoll = { inviteId, targetMapId: targetId, quorum: q, votes };
          const { yes, no, total } = this.computeVoteCounts();
          this.send('map:travel:update' as any, { inviteId, status: 'proposed', targetMapId: targetId, yes, no, total, quorum: q } as any, 'travel:update');
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
            const ok = this.party.travel(undefined as any, this.travelPoll.targetMapId);
            const { yes, no, total } = this.computeVoteCounts();
            this.send('map:travel:update' as any, { inviteId, status: 'approved', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
            this.travelPoll = null;
          } else if (status === 'rejected') {
            const { yes, no, total } = this.computeVoteCounts();
            this.send('map:travel:update' as any, { inviteId, status: 'rejected', targetMapId: this.travelPoll.targetMapId, yes, no, total, quorum: this.travelPoll.quorum } as any, 'travel:update');
            this.travelPoll = null;
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
