import { createLobbyMessage, type LobbyMessage, type LobbyMessageBodies, type LobbyMessageKind } from '../../protocol';
import { PARTICIPANTS_OBJECT_ID, makeParticipantsSnapshot } from './participants.js';
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
  getPeerIds?: () => string[];
  sendToPeer?: (peerId: string, message: LobbyMessage) => boolean;
};

export class HostNetController {
  private readonly publish: Publish;
  private readonly lobbyStore: LobbyStore;
  private readonly busPublish: (message: LobbyMessage) => void;
  private readonly participants: HostParticipantsObject;
  private readonly chat: HostChatObject;
  private readonly router: HostRouter;
  private readonly getPeerIds?: () => string[];
  private readonly sendToPeer?: (peerId: string, message: LobbyMessage) => boolean;
  private readonly ackTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastSentPerPeer = new Map<string, number>();
  private readonly ackedRevPerPeer = new Map<string, number>();

  constructor({ publish, lobbyStore, busPublish, getPeerIds, sendToPeer }: Deps) {
    // wrap publish to track object acks
    this.publish = ((kind, body, ctx) => {
      const ok = publish(kind as any, body as any, ctx);
      if (kind === 'object:replace' || kind === 'object:patch') {
        const b: any = body as any;
        const id = String(b.id);
        const rev = Number(b.rev);
        const peers = this.getPeerIds?.() ?? [];
        if (peers.length === 0) {
          // fallback: global timer (legacy)
          this.lastSentPerPeer.set(`:global:${id}`, rev);
          this.scheduleAck(undefined, id, rev);
        } else {
          for (const peerId of peers) {
            this.lastSentPerPeer.set(`${peerId}:${id}`, rev);
            this.scheduleAck(peerId, id, rev);
          }
        }
      }
      return ok;
    }) as Publish;
    this.lobbyStore = lobbyStore;
    this.busPublish = busPublish;
    this.getPeerIds = getPeerIds;
    this.sendToPeer = sendToPeer;
    this.participants = new HostParticipantsObject({ publish: this.publish, lobbyStore: this.lobbyStore });
    this.chat = new HostChatObject({ publish: this.publish, lobbyStore: this.lobbyStore });
    this.router = new HostRouter({
      send: (kind, body, ctx) => this.publish(kind as any, body as any, ctx),
      lobbyStore: this.lobbyStore,
      publishToBus: (message) => this.busPublish(message),
      participants: this.participants,
      chat: this.chat,
      limiter: undefined,
      onAck: (peerId, id, rev) => this.resolveAck(peerId, id, rev)
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

  private scheduleAck(peerId: string | undefined, id: string, rev: number, attempt = 1) {
    const key = `${peerId ?? ':global'}:${id}:${rev}`;
    if (this.ackTimers.has(key)) {
      clearTimeout(this.ackTimers.get(key)!);
    }
    const timeout = Math.min(5000, 1000 * attempt); // linear backoff up to 5s
    const timer = setTimeout(() => {
      const last = this.lastSentPerPeer.get(`${peerId ?? ':global'}:${id}`);
      if (last !== rev) return; // newer rev sent
      // targeted resend for this peer (if available), otherwise fallback broadcast
      if (peerId && this.sendToPeer) {
        const baseKey = `${peerId}:${id}`;
        const acked = this.ackedRevPerPeer.get(baseKey) ?? 0;
        // Try incremental resend from acked+1 to last
        let sentIncremental = false;
        if (id === PARTICIPANTS_OBJECT_ID && (this.participants as any).getLogsSince) {
          const logs = (this.participants as any).getLogsSince(acked) as { rev: number; ops: any[] }[];
          if (logs && logs.length > 0 && logs.length <= 5) {
            for (const entry of logs) {
              const msg = createLobbyMessage('object:patch', { id, rev: entry.rev, ops: entry.ops } as any);
              this.sendToPeer(peerId, msg);
            }
            sentIncremental = true;
          }
        } else if (id === 'chatlog' && (this.chat as any).getLogsSince) {
          const logs = (this.chat as any).getLogsSince(acked) as { rev: number; ops: any[] }[];
          if (logs && logs.length > 0 && logs.length <= 20) {
            for (const entry of logs) {
              const msg = createLobbyMessage('object:patch', { id, rev: entry.rev, ops: entry.ops } as any);
              this.sendToPeer(peerId, msg);
            }
            sentIncremental = true;
          }
        }
        if (!sentIncremental) {
          // Fallback snapshot
          let msg: LobbyMessage | null = null;
          if (id === PARTICIPANTS_OBJECT_ID) {
            const value = makeParticipantsSnapshot(this.lobbyStore.snapshotWire(), 4);
            msg = createLobbyMessage('object:replace', { id, rev, value } as any);
          } else if (id === 'chatlog') {
            const snap = this.chat.getSnapshot?.() as { rev: number; value: unknown } | undefined;
            if (snap) msg = createLobbyMessage('object:replace', { id, rev: snap.rev, value: snap.value } as any);
          }
          if (msg) this.sendToPeer(peerId, msg);
        }
      } else {
        // broadcast fallback
        if (id === 'participants') this.participants.broadcast('ack:resend');
        else if (id === 'chatlog') this.chat.onRequest(undefined);
      }
      // schedule next attempt (max 3)
      if (attempt < 3) this.scheduleAck(peerId, id, rev, attempt + 1);
      else this.ackTimers.delete(key);
    }, timeout);
    this.ackTimers.set(key, timer);
  }

  private resolveAck(peerId: string | undefined, id: string, rev: number) {
    const key = `${peerId ?? ':global'}:${id}:${rev}`;
    const t = this.ackTimers.get(key);
    if (t) {
      clearTimeout(t);
      this.ackTimers.delete(key);
      console.debug('[object:ack] resolved', { id, rev });
    } else {
      // If timers were rotated due to newer rev, still log for diagnostics
      console.debug('[object:ack] late or already resolved', { id, rev });
    }
    // record last acknowledged rev per peer/object
    if (peerId) this.ackedRevPerPeer.set(`${peerId}:${id}`, rev);
  }
}
