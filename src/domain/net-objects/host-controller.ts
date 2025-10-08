import { createLobbyMessage, type LobbyMessage, type LobbyMessageBodies, type LobbyMessageKind } from '../../protocol';
import type { LobbyStore } from '../session/session-store';
import type { CommonDeps, HostObject } from './types';
import { HostRouter } from './host-router.js';
import {
  HostAckFallback,
  attachHostObject,
  getNetObjectDescriptor,
  getNetObjectDescriptors,
  subscribeNetObjectDescriptors,
  registerNetObject,
  type NetObjectDescriptor
} from './registry.js';
import '../character/character-sync.js';
import { publishParticipantsSnapshot } from '../session/participants-sync.js';
import { netBus } from '../../bus/net-bus.js';
import { getAckSchedulePolicy } from './policies.js';
import { maybeCompressValue } from './codec.js';
// Debug flag for network logs
const DEBUG_NET = Boolean((import.meta as any)?.env?.VITE_NET_DEBUG);

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
  // Optional: Provide descriptors without relying on side-effect imports.
  // This callback will be invoked synchronously during construction.
  provideDescriptors?: (register: (descriptor: NetObjectDescriptor) => void) => void;
};

export class HostNetController {
  private readonly publish: Publish;
  private readonly lobbyStore: LobbyStore;
  private readonly busPublish: (message: LobbyMessage) => void;
  private readonly router: HostRouter;
  private readonly getPeerIds?: () => string[];
  private readonly sendToPeer?: (peerId: string, message: LobbyMessage) => boolean;
  private readonly ackTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastSentPerPeer = new Map<string, number>();
  private readonly ackedRevPerPeer = new Map<string, number>();
  private readonly hostObjects: Map<string, HostObject>;
  private readonly descriptorsById: Map<string, NetObjectDescriptor>;
  private readonly commonDeps: CommonDeps;
  private readonly _descriptorUnsubscribe: () => void;

  constructor({ publish, lobbyStore, busPublish, getPeerIds, sendToPeer, provideDescriptors }: Deps) {
    // wrap publish to track object acks
    this.publish = ((kind, body, ctx) => {
      // Compress oversized replace payloads before sending
      if (kind === 'object:replace') {
        try {
          const b: any = body as any;
          if (b && typeof b === 'object') {
            const original = b.value;
            const compressed = maybeCompressValue(original);
            if (compressed !== original) {
              (b as any).value = compressed;
            }
          }
        } catch {}
      }
      const ok = publish(kind as any, body as any, ctx);
      if (kind === 'object:replace' || kind === 'object:patch') {
        const b: any = body as any;
        const id = String(b.id);
        const rev = Number(b.rev);
        const peers = this.getPeerIds?.() ?? [];
        // Schedule acks only when at least one peer exists.
        if (peers.length > 0) {
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
    this.commonDeps = { publish: this.publish, lobbyStore: this.lobbyStore };
    this.hostObjects = new Map();
    this.descriptorsById = new Map();
    // Allow the caller to register descriptors up-front without global imports.
    try {
      provideDescriptors?.((descriptor) => registerNetObject(descriptor));
    } catch (err) {
      console.warn('[host-net] provideDescriptors failed', err);
    }
    const initialDescriptors = getNetObjectDescriptors();
    for (const descriptor of initialDescriptors) {
      const object = this.instantiateHostObject(descriptor);
      this.hostObjects.set(descriptor.id, object);
      this.descriptorsById.set(descriptor.id, descriptor);
    }
    this.router = new HostRouter({
      send: (kind, body, ctx) => this.publish(kind as any, body as any, ctx),
      lobbyStore: this.lobbyStore,
      publishToBus: (message) => this.busPublish(message),
      descriptors: Array.from(this.descriptorsById.values()),
      objects: this.hostObjects,
      commonDeps: this.commonDeps,
      limiter: undefined,
      onAck: (peerId, id, rev) => this.resolveAck(peerId, id, rev)
    });
    this._descriptorUnsubscribe = subscribeNetObjectDescriptors((descriptor) => {
      if (this.descriptorsById.has(descriptor.id)) return;
      const object = this.instantiateHostObject(descriptor);
      this.descriptorsById.set(descriptor.id, descriptor);
      this.hostObjects.set(descriptor.id, object);
      this.router.addNetObject(descriptor, object);
    });
  }

  bindChannel(channel: RTCDataChannel, peerId?: string) {
    const onMessage = (event: MessageEvent) => {
      // Keep-alive response: reply to minimal non-JSON heartbeat ("\n")
      if (typeof event.data === 'string') {
        const s = event.data as string;
        if (s === '\n') {
          try { channel.send('\r'); } catch {}
          return;
        }
      }
      let payload: unknown = event.data;
      try {
        payload = JSON.parse(event.data);
      } catch {
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
    publishParticipantsSnapshot(this.lobbyStore, context);
  }

  register(object: HostObject) {
    this.hostObjects.set(object.id, object);
    attachHostObject(object);
    const descriptor = this.descriptorsById.get(object.id) ?? getNetObjectDescriptor(object.id);
    if (descriptor && !this.descriptorsById.has(object.id)) {
      this.descriptorsById.set(object.id, descriptor);
      this.router.addNetObject(descriptor, object);
    } else {
      this.router.register(object);
    }
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
    const ack = getAckSchedulePolicy();
    const timeout = Math.min(ack.maxDelayMs, ack.baseDelayMs * attempt);
    try { netBus.publish('net:ack:scheduled', { peerId, objectId: id, rev, attempt }); } catch {}
    const timer = setTimeout(() => {
      const last = this.lastSentPerPeer.get(`${peerId ?? ':global'}:${id}`);
      if (last !== rev) return;
      const descriptor = this.descriptorsById.get(id);
      const hostObject = this.hostObjects.get(id);
      if (!hostObject) {
        if (attempt < 3) this.scheduleAck(peerId, id, rev, attempt + 1);
        else this.ackTimers.delete(key);
        return;
      }
      const ackPolicy = descriptor?.host.ack;
      if (peerId && this.sendToPeer) {
        const baseKey = `${peerId}:${id}`;
        const acked = this.ackedRevPerPeer.get(baseKey) ?? 0;
        let sentIncremental = false;
        const incrementalLimit = ackPolicy?.incrementalMax;
        if (incrementalLimit != null && hostObject.getLogsSince) {
          const logs = hostObject.getLogsSince(acked) ?? [];
          const pending = logs.filter((entry) => entry.rev > acked);
          if (pending.length > 0 && pending.length <= incrementalLimit) {
            for (const entry of pending) {
              const msg = createLobbyMessage('object:patch', { id, rev: entry.rev, ops: entry.ops } as any);
              this.sendToPeer(peerId, msg);
            }
            try { netBus.publish('net:ack:fallback', { peerId, objectId: id, rev, strategy: 'incremental' }); } catch {}
            sentIncremental = true;
          }
        }
        if (!sentIncremental) {
          const fallback = ackPolicy?.fallbackStrategy ?? HostAckFallback.Snapshot;
          if (fallback === HostAckFallback.Snapshot) {
            const snapshot = hostObject.getSnapshot?.();
            if (snapshot) {
              const msg = createLobbyMessage('object:replace', { id, rev, value: snapshot.value } as any);
              this.sendToPeer(peerId, msg);
            } else {
              hostObject.onRequest(undefined);
            }
            try { netBus.publish('net:ack:fallback', { peerId, objectId: id, rev, strategy: 'snapshot' }); } catch {}
          } else if (fallback === HostAckFallback.OnRequest) {
            hostObject.onRequest(undefined);
            try { netBus.publish('net:ack:fallback', { peerId, objectId: id, rev, strategy: 'onRequest' }); } catch {}
          } else if (fallback === HostAckFallback.None) {
            // no-op
            try { netBus.publish('net:ack:fallback', { peerId, objectId: id, rev, strategy: 'none' }); } catch {}
          }
        }
      } else {
        const broadcast = ackPolicy?.broadcast;
        if (broadcast) {
          broadcast(hostObject, this.commonDeps);
        } else if ((ackPolicy?.fallbackStrategy ?? HostAckFallback.Snapshot) === HostAckFallback.None) {
          // no-op
        } else {
          hostObject.onRequest(undefined);
        }
      }
      if (attempt < ack.maxAttempts) this.scheduleAck(peerId, id, rev, attempt + 1);
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
      if (DEBUG_NET) console.debug('[object:ack] resolved', { id, rev });
      try { netBus.publish('net:ack:resolved', { peerId, objectId: id, rev }); } catch {}
    } else {
      // If timers were rotated due to newer rev, still log for diagnostics
      if (DEBUG_NET) console.debug('[object:ack] late or already resolved', { id, rev });
    }
    // record last acknowledged rev per peer/object
    if (peerId) this.ackedRevPerPeer.set(`${peerId}:${id}`, rev);
  }

  // Ingest a locally-originated lobby message (host-initiated requests)
  ingest(payload: LobbyMessage) {
    try {
      this.router.handle(payload);
    } catch (err) {
      console.error('[host-controller] ingest failed', err);
    }
  }

  dispose() {
    this._descriptorUnsubscribe();
    // Clear any pending ACK timers to avoid leaks
    for (const t of this.ackTimers.values()) {
      try { clearTimeout(t); } catch {}
    }
    this.ackTimers.clear();
  }

  private instantiateHostObject(descriptor: NetObjectDescriptor): HostObject {
    const existing = this.hostObjects.get(descriptor.id);
    if (existing) return existing;
    const object = descriptor.host.create(this.commonDeps, {
      get: <T extends HostObject>(id: string) => this.hostObjects.get(id) as T | null
    });
    if (object.id !== descriptor.id) {
      throw new Error(`Host object id mismatch for ${descriptor.id}`);
    }
    attachHostObject(object);
    return object;
  }
}
