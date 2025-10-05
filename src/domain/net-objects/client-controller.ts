import type { LobbyMessage, LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import { parseLobbyMessage } from '../../protocol';
import type { LobbyStore } from '../session/session-store';
import { ClientNetObjectStore } from './client-store';
import { isParticipantsSnapshot, PARTICIPANTS_OBJECT_ID } from './participants';

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

export class ClientNetController {
  private readonly publish: Publish;
  private readonly lobbyStore: LobbyStore;
  private readonly busPublish: (message: LobbyMessage) => void;
  private readonly store = new ClientNetObjectStore();

  constructor({ publish, lobbyStore, busPublish }: Deps) {
    this.publish = publish;
    this.lobbyStore = lobbyStore;
    this.busPublish = busPublish;
  }

  bindChannel(channel: RTCDataChannel) {
    const onMessage = (event: MessageEvent) => {
      let payload: unknown = event.data;
      try {
        payload = JSON.parse(event.data);
      } catch (_err) {
        // Ignore non-JSON payloads
      }
      this.handlePayload(payload, channel);
    };
    channel.addEventListener('message', onMessage);
  }

  requestSnapshots() {
    this.publish('object:request', { id: PARTICIPANTS_OBJECT_ID }, 'request participants');
    this.publish('object:request', { id: 'chatlog' }, 'request chatlog');
  }

  private handlePayload(payload: unknown, _channel?: RTCDataChannel) {
    const message = parseLobbyMessage(payload);
    if (!message) return;

    switch (message.kind) {
      case 'object:replace': {
        const { id, rev, value } = message.body as { id: string; rev: number; value: unknown };
        const applied = this.store.applyReplace(id, rev, value);
        if (!applied) break;
        if (id === PARTICIPANTS_OBJECT_ID) {
          if (isParticipantsSnapshot(value)) {
            this.lobbyStore.replaceFromWire(value.list);
          } else if (Array.isArray((value as any)?.participants)) {
            this.lobbyStore.replaceFromWire((value as any).participants as any);
          } else if (Array.isArray((value as any)?.list)) {
            this.lobbyStore.replaceFromWire((value as any).list as any);
          }
        }
        break;
      }
      case 'object:patch': {
        const { id, rev, ops } = message.body as any;
        const ok = this.store.applyPatch(id, rev, ops);
        if (!ok) {
          // Fallback to request full snapshot if patch cannot be applied
          this.publish('object:request', { id }, 'patch-fallback-request');
        }
        break;
      }
      case 'state': {
        // Legacy fallback path
        this.lobbyStore.replaceFromWire(message.body.participants);
        break;
      }
      default:
        break;
    }

    // Forward to lobby bus for other features (chat, agents, etc.)
    this.busPublish(message);
  }
}

