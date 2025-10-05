import type { LobbyMessage, LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import { parseLobbyMessage } from '../../protocol';
import type { LobbyStore } from '../session/session-store';
import { PARTICIPANTS_OBJECT_ID } from './participants';
import type { ChatEntry } from './chat';
import { HostParticipantsObject } from './participants-host';
import { SlidingWindowLimiter } from './rate-limit';
import type { HostObject } from './types';
import { HostChatObject } from './chat-host';

export type Publish = <K extends LobbyMessageKind>(
  kind: K,
  body: LobbyMessageBodies[K],
  context?: string
) => boolean;

type Deps = {
  publish: Publish;
  lobbyStore: LobbyStore;
  busPublish: (message: LobbyMessage) => void;
};

export class HostNetController {
  private readonly publish: Publish;
  private readonly lobbyStore: LobbyStore;
  private readonly busPublish: (message: LobbyMessage) => void;
  private readonly participants: HostParticipantsObject;
  private readonly chat: HostChatObject;
  private readonly registry = new Map<string, HostObject>();
  private readonly chatLimiter = new SlidingWindowLimiter(5, 10_000); // 5 msgs / 10s per author

  constructor({ publish, lobbyStore, busPublish }: Deps) {
    this.publish = publish;
    this.lobbyStore = lobbyStore;
    this.busPublish = busPublish;
    this.participants = new HostParticipantsObject({ publish: this.publish, lobbyStore: this.lobbyStore });
    this.chat = new HostChatObject({ publish: this.publish, lobbyStore: this.lobbyStore });
    this.register(this.participants);
    this.register(this.chat);
  }

  bindChannel(channel: RTCDataChannel) {
    const onMessage = (event: MessageEvent) => {
      let payload: unknown = event.data;
      try {
        payload = JSON.parse(event.data);
      } catch (_err) {
        // Ignore non-JSON payloads
      }
      this.handlePayload(payload);
    };
    channel.addEventListener('message', onMessage);
  }

  onPeerConnected(_peerId: string) {
    // Optionally push current participants snapshot when a peer connects
    this.participants.broadcast('peer-connected');
  }

  requestObjectSnapshot(id: string, sinceRev?: number) {
    const obj = this.registry.get(id);
    obj?.onRequest(sinceRev);
  }

  private handlePayload(payload: unknown) {
    const message = parseLobbyMessage(payload);
    if (!message) return;

    switch (message.kind) {
      case 'hello': {
        this.lobbyStore.upsertFromWire(message.body.participant);
        this.participants.onHello();
        break;
      }
      case 'ready': {
        const { participantId, ready } = message.body;
        const raw = this.lobbyStore.snapshotWire().map((p) =>
          p.id === participantId ? { ...p, ready } : p
        );
        this.lobbyStore.replaceFromWire(raw);
        this.participants.onReady();
        break;
      }
      case 'leave': {
        this.lobbyStore.remove(message.body.participantId);
        this.participants.onLeave();
        break;
      }
      case 'object:request': {
        const { id, sinceRev } = message.body;
        this.requestObjectSnapshot(id, sinceRev);
        break;
      }
      case 'chat:append:request': {
        const authorId = String((message.body as any).authorId ?? this.lobbyStore.localParticipantIdRef.current ?? 'host');
        const rawBody = String((message.body as any).body ?? '');
        const trimmed = rawBody.trim();
        if (!trimmed) break; // ignore empty
        if (!this.chatLimiter.allow(authorId)) {
          console.warn('[chat] rate limited', { authorId });
          break;
        }
        const self = this.lobbyStore.participantsRef.current.find((p) => p.id === authorId);
        const entry: ChatEntry = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          authorId,
          authorName: self?.name ?? 'Host',
          authorTag: self?.tag ?? '#HOST',
          authorRole: 'host',
          body: trimmed,
          at: Date.now()
        };
        this.chat.append(entry, 'chat-append');
        break;
      }
      default:
        break;
    }

    // Always forward to lobby bus so feature hooks remain reactive
    this.busPublish(message);
  }

  broadcastParticipants(context: string = 'participants-sync') {
    this.participants.broadcast(context);
  }

  register(object: HostObject) {
    this.registry.set(object.id, object);
  }
}
