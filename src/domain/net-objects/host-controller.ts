import type { LobbyMessage, LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import { parseLobbyMessage } from '../../protocol';
import type { LobbyStore } from '../session/session-store';
import { PARTICIPANTS_OBJECT_ID, makeParticipantsSnapshot } from './participants';
import { HostReplicator } from './replicator';
import { ChatHostStore, type ChatEntry } from './chat';

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
  private readonly replicator: HostReplicator;
  private readonly chat: ChatHostStore;

  constructor({ publish, lobbyStore, busPublish }: Deps) {
    this.publish = publish;
    this.lobbyStore = lobbyStore;
    this.busPublish = busPublish;
    this.replicator = new HostReplicator((kind, body, context) => this.publish(kind as any, body as any, context));
    this.chat = new ChatHostStore((kind, body, context) => this.publish(kind as any, body as any, context));
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
    this.broadcastParticipants('peer-connected');
  }

  requestObjectSnapshot(id: string, sinceRev?: number) {
    if (id === PARTICIPANTS_OBJECT_ID) {
      this.replicator.onRequest(PARTICIPANTS_OBJECT_ID, sinceRev, 'object-request participants');
    } else if (id === 'chatlog') {
      this.chat.onRequest(sinceRev, 'object-request chatlog');
    }
  }

  private handlePayload(payload: unknown) {
    const message = parseLobbyMessage(payload);
    if (!message) return;

    switch (message.kind) {
      case 'hello': {
        // Register or update participant, then broadcast authoritative snapshot
        this.lobbyStore.upsertFromWire(message.body.participant);
        this.broadcastParticipants('hello');
        break;
      }
      case 'ready': {
        const { participantId, ready } = message.body;
        const raw = this.lobbyStore.snapshotWire().map((p) =>
          p.id === participantId ? { ...p, ready } : p
        );
        this.lobbyStore.replaceFromWire(raw);
        this.broadcastParticipants('ready-update');
        break;
      }
      case 'leave': {
        this.lobbyStore.remove(message.body.participantId);
        this.broadcastParticipants('leave-relay');
        break;
      }
      case 'object:request': {
        const { id, sinceRev } = message.body;
        this.requestObjectSnapshot(id, sinceRev);
        break;
      }
      case 'chat:append:request': {
        const authorId = String((message.body as any).authorId ?? this.lobbyStore.localParticipantIdRef.current ?? 'host');
        const self = this.lobbyStore.participantsRef.current.find((p) => p.id === authorId);
        const entry: ChatEntry = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          authorId,
          authorName: self?.name ?? 'Host',
          authorTag: self?.tag ?? '#HOST',
          authorRole: 'host',
          body: String((message.body as any).body ?? ''),
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
    const value = makeParticipantsSnapshot(this.lobbyStore.snapshotWire(), 4);
    this.replicator.set(PARTICIPANTS_OBJECT_ID, value, context);
  }
}
