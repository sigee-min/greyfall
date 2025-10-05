import type { LobbyMessage, LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import type { LobbyStore } from '../session/session-store';
import { HostParticipantsObject } from './participants-host.js';
import type { HostObject } from './types';
import { HostChatObject } from './chat-host.js';
import { HostRouter } from './host-router.js';

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

  private readonly ackTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastSent = new Map<string, number>();

  constructor({ publish, lobbyStore, busPublish }: Deps) {
    // wrap publish to track object acks
    this.publish = ((kind, body, ctx) => {
      const ok = publish(kind as any, body as any, ctx);
      if (kind === 'object:replace' || kind === 'object:patch') {
        const b: any = body as any;
        const id = String(b.id);
        const rev = Number(b.rev);
        this.lastSent.set(id, rev);
        this.scheduleAck(id, rev);
      }
      return ok;
    }) as Publish;
    this.lobbyStore = lobbyStore;
    this.busPublish = busPublish;
    this.participants = new HostParticipantsObject({ publish: this.publish, lobbyStore: this.lobbyStore });
    this.chat = new HostChatObject({ publish: this.publish, lobbyStore: this.lobbyStore });
    this.router = new HostRouter({
      send: (kind, body, ctx) => this.publish(kind as any, body as any, ctx),
      lobbyStore: this.lobbyStore,
      publishToBus: (message) => this.busPublish(message),
      participants: this.participants,
      chat: this.chat,
      limiter: undefined,
      onAck: (id, rev) => this.resolveAck(id, rev)
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

  private scheduleAck(id: string, rev: number, attempt = 1) {
    const key = `${id}:${rev}`;
    if (this.ackTimers.has(key)) {
      clearTimeout(this.ackTimers.get(key)!);
    }
    const timeout = Math.min(5000, 1000 * attempt); // linear backoff up to 5s
    const timer = setTimeout(() => {
      const last = this.lastSent.get(id);
      if (last !== rev) return; // newer rev sent
      // resend snapshot for this object
      if (id === 'participants') this.participants.broadcast('ack:resend');
      else if (id === 'chatlog') this.chat.onRequest(undefined);
      // schedule next attempt (max 3)
      if (attempt < 3) this.scheduleAck(id, rev, attempt + 1);
      else this.ackTimers.delete(key);
    }, timeout);
    this.ackTimers.set(key, timer);
  }

  private resolveAck(id: string, rev: number) {
    const last = this.lastSent.get(id);
    if (last !== rev) return;
    const key = `${id}:${rev}`;
    const t = this.ackTimers.get(key);
    if (t) clearTimeout(t);
    this.ackTimers.delete(key);
  }
}
