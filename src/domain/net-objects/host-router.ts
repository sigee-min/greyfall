import { parseLobbyMessage, type LobbyMessage } from '../../protocol';
import type { LobbyStore } from '../session/session-store';
import type { HostObject } from './types';
import { HostParticipantsObject } from './participants-host';
import { HostChatObject } from './chat-host';
import { SlidingWindowLimiter } from './rate-limit';
import { PeerParticipantMap } from './peer-map';

type Publish = (message: LobbyMessage) => void;
type Send = <K extends LobbyMessage['kind']>(kind: K, body: Extract<LobbyMessage, { kind: K }>['body'], context?: string) => boolean;

export class HostRouter {
  private readonly send: Send;
  private readonly lobbyStore: LobbyStore;
  private readonly publishToBus: Publish;
  private readonly participants: HostParticipantsObject;
  private readonly chat: HostChatObject;
  private readonly limiter: SlidingWindowLimiter;
  private readonly map = new PeerParticipantMap();
  private readonly registry = new Map<string, HostObject>();

  constructor(args: {
    send: Send;
    lobbyStore: LobbyStore;
    publishToBus: Publish;
    participants: HostParticipantsObject;
    chat: HostChatObject;
    limiter?: SlidingWindowLimiter;
  }) {
    this.send = args.send;
    this.lobbyStore = args.lobbyStore;
    this.publishToBus = args.publishToBus;
    this.participants = args.participants;
    this.chat = args.chat;
    this.limiter = args.limiter ?? new SlidingWindowLimiter(5, 10_000);
    this.register(this.participants);
    this.register(this.chat);
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

    switch (message.kind) {
      case 'hello': {
        const p = message.body.participant;
        this.lobbyStore.upsertFromWire(p);
        this.participants.upsert(p, 'hello:merge');
        if (peerId) this.map.set(peerId, p.id);
        break;
      }
      case 'ready': {
        const { participantId, ready } = message.body;
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
        this.registry.get(id)?.onRequest(sinceRev);
        break;
      }
      case 'chat:append:request': {
        const authorId = String((message.body as any).authorId ?? this.lobbyStore.localParticipantIdRef.current ?? 'host');
        const rawBody = String((message.body as any).body ?? '');
        const trimmed = rawBody.trim();
        if (!trimmed) break;
        if (!this.limiter.allow(authorId)) {
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
            authorRole: 'host',
            body: trimmed,
            at: Date.now()
          },
          'chat-append'
        );
        break;
      }
      default:
        break;
    }

    this.publishToBus(message);
  }
}

