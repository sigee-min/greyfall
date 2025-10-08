import type { LobbyMessage, LobbyMessageBodies, LobbyMessageKind } from '../../protocol/index.js';
import { parseLobbyMessage } from '../../protocol/index.js';
import type { LobbyStore } from '../session/session-store';
import { ClientNetObjectStore } from './client-store';
import { maybeDecompressValue } from './codec.js';
import { CTX_OBJECT_ACK_PATCH, CTX_OBJECT_ACK_REPLACE, CTX_PATCH_FALLBACK_REQUEST, CTX_PATCH_STALLED_REQUEST } from './contexts.js';
import {
  attachClientObject,
  getNetObjectDescriptors,
  subscribeNetObjectDescriptors,
  registerNetObject,
  type NetObjectDescriptor
} from './registry.js';
// Note: Built-in net object registration via side-effect imports was used here.
// We now support descriptor callback injection through the constructor to avoid
// forcing imports at this layer. These imports are intentionally removed.
// To maintain previous behavior, import `src/domain/net-objects/builtins.ts`
// once at your composition root, or pass `provideDescriptors` to the constructor.

export type Publish = <K extends LobbyMessageKind>(
  kind: K,
  body: LobbyMessageBodies[K],
  context?: string
) => boolean;

type Deps = {
  publish: Publish;
  lobbyStore: LobbyStore;
  busPublish: (message: LobbyMessage) => void;
  // Optional: Provide descriptors without relying on side-effect imports.
  // This callback will be invoked synchronously during construction.
  provideDescriptors?: (register: (descriptor: NetObjectDescriptor) => void) => void;
};

export class ClientNetController {
  private readonly publish: Publish;
  private readonly lobbyStore: LobbyStore;
  private readonly busPublish: (message: LobbyMessage) => void;
  private readonly store: ClientNetObjectStore;
  private readonly registry: Map<string, { onReplace: (rev: number, value: unknown) => void; onPatch?: (rev: number, ops: unknown[]) => void }>;
  private readonly snapshotRequests = new Map<string, string>();
  private readonly knownDescriptors = new Set<string>();
  private readonly _descriptorUnsubscribe: () => void;

  constructor({ publish, lobbyStore, busPublish, provideDescriptors }: Deps) {
    this.publish = publish;
    this.lobbyStore = lobbyStore;
    this.busPublish = busPublish;
    this.registry = new Map();
    this.store = new ClientNetObjectStore({
      onStalled: (id, sinceRev) => {
        if (typeof sinceRev === 'number') this.publish('object:request', { id, sinceRev }, CTX_PATCH_STALLED_REQUEST);
        else this.publish('object:request', { id }, CTX_PATCH_STALLED_REQUEST);
      }
    });

    // Allow the caller to register descriptors up-front without global imports.
    // This keeps controller decoupled from concrete net-object modules.
    try {
      provideDescriptors?.((descriptor) => registerNetObject(descriptor));
    } catch (err) {
      console.warn('[client-net] provideDescriptors failed', err);
    }

    const descriptors = getNetObjectDescriptors();
    for (const descriptor of descriptors) {
      this.addDescriptor(descriptor);
    }
    this._descriptorUnsubscribe = subscribeNetObjectDescriptors((descriptor) => this.addDescriptor(descriptor));
  }

  bindChannel(channel: RTCDataChannel) {
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
        const { id, rev } = message.body as { id: string; rev: number; value: unknown };
        const value = maybeDecompressValue((message.body as any).value);
        const applied = this.store.applyReplace(id, rev, value);
        if (!applied) break;
        const obj = this.registry.get(id);
        obj?.onReplace(rev, value);
        // acknowledge successful apply
        this.publish('object:ack', { id, rev }, CTX_OBJECT_ACK_REPLACE);
        break;
      }
      case 'object:patch': {
        const { id, rev, ops } = message.body as any;
        const status = this.store.applyPatch(id, rev, ops);
        if (status === 'rejected') {
          // Fallback to request full snapshot if patch cannot be applied
          const cur = this.store.get(id);
          const sinceRev = cur?.rev;
          if (typeof sinceRev === 'number') this.publish('object:request', { id, sinceRev }, CTX_PATCH_FALLBACK_REQUEST);
          else this.publish('object:request', { id }, CTX_PATCH_FALLBACK_REQUEST);
        } else if (status === 'applied') {
          const obj = this.registry.get(id);
          obj?.onPatch?.(rev, ops);
          this.publish('object:ack', { id, rev }, CTX_OBJECT_ACK_PATCH);
        } else {
          // queued: wait for missing revs, do not ACK yet
        }
        break;
      }
      // 'state' legacy path removed: participants now sync via SyncModel
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
