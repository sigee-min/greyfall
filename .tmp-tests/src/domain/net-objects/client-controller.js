import { parseLobbyMessage } from '../../protocol/index.js';
import { ClientNetObjectStore } from './client-store';
import { attachClientObject, getNetObjectDescriptors, subscribeNetObjectDescriptors, registerNetObject } from './registry.js';
export class ClientNetController {
    constructor({ publish, lobbyStore, busPublish, provideDescriptors }) {
        this.store = new ClientNetObjectStore();
        this.snapshotRequests = new Map();
        this.knownDescriptors = new Set();
        this.publish = publish;
        this.lobbyStore = lobbyStore;
        this.busPublish = busPublish;
        this.registry = new Map();
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
                const { id, rev, value } = message.body;
                const applied = this.store.applyReplace(id, rev, value);
                if (!applied)
                    break;
                const obj = this.registry.get(id);
                obj?.onReplace(rev, value);
                // acknowledge successful apply
                this.publish('object:ack', { id, rev }, 'object-ack replace');
                break;
            }
            case 'object:patch': {
                const { id, rev, ops } = message.body;
                const ok = this.store.applyPatch(id, rev, ops);
                if (!ok) {
                    // Fallback to request full snapshot if patch cannot be applied
                    const cur = this.store.get(id);
                    const sinceRev = cur?.rev;
                    if (typeof sinceRev === 'number') {
                        this.publish('object:request', { id, sinceRev }, 'patch-fallback-request');
                    }
                    else {
                        this.publish('object:request', { id }, 'patch-fallback-request');
                    }
                }
                else {
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
