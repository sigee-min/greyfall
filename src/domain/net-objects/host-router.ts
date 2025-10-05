import { parseLobbyMessage, type LobbyMessage } from '../../protocol/index.js';
import type { LobbyStore } from '../session/session-store';
import type { HostObject } from './types';
import { HostParticipantsObject } from './participants-host.js';
import { HostChatObject } from './chat-host.js';
import { HostWorldPositionsObject } from './world-positions-host.js';
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
  private readonly limiter: SlidingWindowLimiter;
  private readonly onAck?: (peerId: string | undefined, id: string, rev: number) => void;
  private readonly map = new PeerParticipantMap();
  private readonly registry = new Map<string, HostObject>();

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
}
