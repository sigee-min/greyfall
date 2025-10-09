import { parseLobbyMessage } from '../../protocol/index.js';
import { ClientNetObjectStore } from './client-store';
import { maybeDecompressValue } from './codec.js';
import { CTX_OBJECT_ACK_PATCH, CTX_OBJECT_ACK_REPLACE, CTX_PATCH_FALLBACK_REQUEST, CTX_PATCH_STALLED_REQUEST } from './contexts.js';
import { attachClientObject, getNetObjectDescriptors, subscribeNetObjectDescriptors, registerNetObject } from './registry.js';
export class ClientNetController {
    constructor({ publish, lobbyStore, busPublish, provideDescriptors }) {
        this.snapshotRequests = new Map();
        this.knownDescriptors = new Set();
        this.publish = publish;
        this.lobbyStore = lobbyStore;
        this.busPublish = busPublish;
        this.registry = new Map();
        this.store = new ClientNetObjectStore({
            onStalled: (id, sinceRev) => {
                if (typeof sinceRev === 'number')
                    this.publish('object:request', { id, sinceRev }, CTX_PATCH_STALLED_REQUEST);
                else
                    this.publish('object:request', { id }, CTX_PATCH_STALLED_REQUEST);
            }
        });
        // Allow the caller to register descriptors up-front without global imports.
        // This keeps controller decoupled from concrete net-object modules.
        try {
            provideDescriptors?.((descriptor) => registerNetObject(descriptor));
        }
        catch (err) {
            console.warn('[client-net] provideDescriptors failed', err);
        }
        const descriptors = getNetObjectDescriptors();
        for (const descriptor of descriptors) {
            this.addDescriptor(descriptor);
        }
        this._descriptorUnsubscribe = subscribeNetObjectDescriptors((descriptor) => this.addDescriptor(descriptor));
    }
    bindChannel(channel) {
        const onMessage = (event) => {
            // Keep-alive response: reply to minimal non-JSON heartbeat ("\n")
            if (typeof event.data === 'string') {
                const s = event.data;
                if (s === '\n') {
                    try {
                        channel.send('\r');
                    }
                    catch { }
                    return;
                }
            }
            let payload = event.data;
            try {
                payload = JSON.parse(event.data);
            }
            catch {
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
    handlePayload(payload, _channel) {
        const message = parseLobbyMessage(payload);
        if (!message)
            return;
        switch (message.kind) {
            case 'object:replace': {
                const { id, rev } = message.body;
                const value = maybeDecompressValue(message.body.value);
                const applied = this.store.applyReplace(id, rev, value);
                if (!applied)
                    break;
                const obj = this.registry.get(id);
                obj?.onReplace(rev, value);
                // acknowledge successful apply
                this.publish('object:ack', { id, rev }, CTX_OBJECT_ACK_REPLACE);
                break;
            }
            case 'object:patch': {
                const { id, rev, ops } = message.body;
                const status = this.store.applyPatch(id, rev, ops);
                if (status === 'rejected') {
                    // Fallback to request full snapshot if patch cannot be applied
                    const cur = this.store.get(id);
                    const sinceRev = cur?.rev;
                    if (typeof sinceRev === 'number')
                        this.publish('object:request', { id, sinceRev }, CTX_PATCH_FALLBACK_REQUEST);
                    else
                        this.publish('object:request', { id }, CTX_PATCH_FALLBACK_REQUEST);
                }
                else if (status === 'applied') {
                    const obj = this.registry.get(id);
                    obj?.onPatch?.(rev, ops);
                    this.publish('object:ack', { id, rev }, CTX_OBJECT_ACK_PATCH);
                }
                else {
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
    register(object) {
        this.registry.set(object.id, { onReplace: object.onReplace, onPatch: object.onPatch });
    }
    dispose() {
        this._descriptorUnsubscribe();
    }
    addDescriptor(descriptor) {
        if (this.knownDescriptors.has(descriptor.id))
            return;
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
