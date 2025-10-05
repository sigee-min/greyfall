import type { LobbyMessage, LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import type { LobbyStore } from '../session/session-store';
import { HostParticipantsObject } from './participants-host';
import type { HostObject } from './types';
import { HostChatObject } from './chat-host';
import { HostRouter } from './host-router';

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
  private readonly router: HostRouter;

  constructor({ publish, lobbyStore, busPublish }: Deps) {
    this.publish = publish;
    this.lobbyStore = lobbyStore;
    this.busPublish = busPublish;
    this.participants = new HostParticipantsObject({ publish: this.publish, lobbyStore: this.lobbyStore });
    this.chat = new HostChatObject({ publish: this.publish, lobbyStore: this.lobbyStore });
    this.router = new HostRouter({
      send: (kind, body, ctx) => this.publish(kind as any, body as any, ctx),
      lobbyStore: this.lobbyStore,
      publishToBus: (message) => this.busPublish(message),
      participants: this.participants,
      chat: this.chat
    });
  }

  bindChannel(channel: RTCDataChannel, peerId?: string) {
    const onMessage = (event: MessageEvent) => {
      let payload: unknown = event.data;
      try {
        payload = JSON.parse(event.data);
      } catch (_err) {
        // ignore non-JSON payloads
      }
      this.router.handle(payload, peerId);
    };
    channel.addEventListener('message', onMessage);
  }

  onPeerConnected(peerId: string) {
    this.router.onPeerConnected(peerId);
  }

  // Message handling moved into HostRouter

  broadcastParticipants(context: string = 'participants-sync') {
    this.participants.broadcast(context);
  }

  register(object: HostObject) {
    this.router.register(object);
  }

  onPeerDisconnected(peerId: string) {
    this.router.onPeerDisconnected(peerId);
  }

  updateParticipantReady(participantId: string, ready: boolean, context = 'ready:host-toggle') {
    this.router.updateParticipantReady(participantId, ready, context);
  }
}
