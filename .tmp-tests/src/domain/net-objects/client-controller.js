import { parseLobbyMessage } from '../../protocol/index.js';
import { ClientNetObjectStore } from './client-store';
import { ClientParticipantsObject } from './participants-client.js';
import { PARTICIPANTS_OBJECT_ID } from './participants.js';
export class ClientNetController {
    constructor({ publish, lobbyStore, busPublish }) {
        this.store = new ClientNetObjectStore();
        this.publish = publish;
        this.lobbyStore = lobbyStore;
        this.busPublish = busPublish;
        this.registry = new Map();
        // register built-in participants client object
        const participants = new ClientParticipantsObject(this.lobbyStore);
        this.registry.set(participants.id, {
            onReplace: (rev, value) => participants.onReplace(rev, value),
            onPatch: (rev, ops) => participants.onPatch?.(rev, ops)
        });
    }
    bindChannel(channel) {
        const onMessage = (event) => {
            let payload = event.data;
            try {
                payload = JSON.parse(event.data);
            }
            catch (_err) {
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
                    this.publish('object:request', { id }, 'patch-fallback-request');
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
}
