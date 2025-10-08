import type { LobbyMessage, LobbyMessageBodies, LobbyMessageKind } from '../../protocol/index.js';
import { parseLobbyMessage } from '../../protocol/index.js';
import type { LobbyStore } from '../session/session-store';
import { ClientNetObjectStore } from './client-store';
import {
  attachClientObject,
  getNetObjectDescriptors,
  subscribeNetObjectDescriptors,
  type NetObjectDescriptor
} from './registry.js';
// Side-effect imports to ensure builtin net objects self-register before controller initialization.
import './chat-host.js';
import './world-positions-host.js';
import './party-host.js';
import '../character/character-sync.js';
// LLM progress net-object removed

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
  private readonly registry: Map<string, { onReplace: (rev: number, value: unknown) => void; onPatch?: (rev: number, ops: unknown[]) => void }>;
  private readonly snapshotRequests = new Map<string, string>();
  private readonly knownDescriptors = new Set<string>();
  private readonly _descriptorUnsubscribe: () => void;

  constructor({ publish, lobbyStore, busPublish }: Deps) {
    this.publish = publish;
    this.lobbyStore = lobbyStore;
    this.busPublish = busPublish;
    this.registry = new Map();

    const descriptors = getNetObjectDescriptors();
    for (const descriptor of descriptors) {
      this.addDescriptor(descriptor);
    }
    this._descriptorUnsubscribe = subscribeNetObjectDescriptors((descriptor) => this.addDescriptor(descriptor));
  }

  bindChannel(channel: RTCDataChannel) {
    const onMessage = (event: MessageEvent) => {
      let payload: unknown = event.data;
      try {
        payload = JSON.parse(event.data);
      } catch {
        /* ignore non-JSON payloads */
      }
      this.handlePayload(payload, channel);
    };
    channel.addEventListener('message', onMessage);
  }

  requestSnapshots() {
    for (const [id, context] of this.snapshotRequests.entries()) {
      this.publish('object:request', { id }, context);
    }
  }

  private handlePayload(payload: unknown, _channel?: RTCDataChannel) {
    const message = parseLobbyMessage(payload);
    if (!message) return;

    switch (message.kind) {
      case 'object:replace': {
        const { id, rev, value } = message.body as { id: string; rev: number; value: unknown };
        const applied = this.store.applyReplace(id, rev, value);
        if (!applied) break;
        const obj = this.registry.get(id);
        obj?.onReplace(rev, value);
        // acknowledge successful apply
        this.publish('object:ack', { id, rev }, 'object-ack replace');
        break;
      }
      case 'object:patch': {
        const { id, rev, ops } = message.body as any;
        const ok = this.store.applyPatch(id, rev, ops);
        if (!ok) {
          // Fallback to request full snapshot if patch cannot be applied
          const cur = this.store.get(id);
          const sinceRev = cur?.rev;
          if (typeof sinceRev === 'number') {
            this.publish('object:request', { id, sinceRev }, 'patch-fallback-request');
          } else {
            this.publish('object:request', { id }, 'patch-fallback-request');
          }
        } else {
          const obj = this.registry.get(id);
          obj?.onPatch?.(rev, ops);
          this.publish('object:ack', { id, rev }, 'object-ack patch');
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

  register(object: { id: string; onReplace: (rev: number, value: unknown) => void; onPatch?: (rev: number, ops: unknown[]) => void }) {
    this.registry.set(object.id, { onReplace: object.onReplace, onPatch: object.onPatch });
  }

  dispose() {
    this._descriptorUnsubscribe();
  }

  private addDescriptor(descriptor: NetObjectDescriptor) {
    if (this.knownDescriptors.has(descriptor.id)) return;
    this.knownDescriptors.add(descriptor.id);
    const client = descriptor.client;
    if (client?.requestOnStart) {
      this.snapshotRequests.set(descriptor.id, client.requestContext ?? `request ${descriptor.id}`);
    }
    if (client?.create) {
      const instance = client.create({ lobbyStore: this.lobbyStore });
      if (instance) {
        if (instance.id !== descriptor.id) {
          console.warn('[client-net] descriptor id mismatch', { descriptor: descriptor.id, instance: instance.id });
        }
        this.registry.set(descriptor.id, {
          onReplace: (rev, value) => instance.onReplace(rev, value),
          onPatch: (rev, ops) => instance.onPatch?.(rev, ops)
        });
        attachClientObject(instance);
      }
    }
  }
}
