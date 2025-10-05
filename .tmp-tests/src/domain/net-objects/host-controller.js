import { parseLobbyMessage } from '../../protocol';
import { PARTICIPANTS_OBJECT_ID } from './participants';
import { ChatHostStore } from './chat';
import { HostParticipantsObject } from './participants-host';
export class HostNetController {
    constructor({ publish, lobbyStore, busPublish }) {
        Object.defineProperty(this, "publish", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "lobbyStore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "busPublish", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "participants", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "chat", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.publish = publish;
        this.lobbyStore = lobbyStore;
        this.busPublish = busPublish;
        this.participants = new HostParticipantsObject({ publish: this.publish, lobbyStore: this.lobbyStore });
        this.chat = new ChatHostStore((kind, body, context) => this.publish(kind, body, context));
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
            this.handlePayload(payload);
        };
        channel.addEventListener('message', onMessage);
    }
    onPeerConnected(_peerId) {
        // Optionally push current participants snapshot when a peer connects
        this.participants.broadcast('peer-connected');
    }
    requestObjectSnapshot(id, sinceRev) {
        if (id === PARTICIPANTS_OBJECT_ID) {
            this.participants.onRequest(sinceRev);
        }
        else if (id === 'chatlog') {
            this.chat.onRequest(sinceRev, 'object-request chatlog');
        }
    }
    handlePayload(payload) {
        const message = parseLobbyMessage(payload);
        if (!message)
            return;
        switch (message.kind) {
            case 'hello': {
                this.lobbyStore.upsertFromWire(message.body.participant);
                this.participants.onHello();
                break;
            }
            case 'ready': {
                const { participantId, ready } = message.body;
                const raw = this.lobbyStore.snapshotWire().map((p) => p.id === participantId ? { ...p, ready } : p);
                this.lobbyStore.replaceFromWire(raw);
                this.participants.onReady();
                break;
            }
            case 'leave': {
                this.lobbyStore.remove(message.body.participantId);
                this.participants.onLeave();
                break;
            }
            case 'object:request': {
                const { id, sinceRev } = message.body;
                this.requestObjectSnapshot(id, sinceRev);
                break;
            }
            case 'chat:append:request': {
                const authorId = String(message.body.authorId ?? this.lobbyStore.localParticipantIdRef.current ?? 'host');
                const self = this.lobbyStore.participantsRef.current.find((p) => p.id === authorId);
                const entry = {
                    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    authorId,
                    authorName: self?.name ?? 'Host',
                    authorTag: self?.tag ?? '#HOST',
                    authorRole: 'host',
                    body: String(message.body.body ?? ''),
                    at: Date.now()
                };
                this.chat.append(entry, 'chat-append');
                break;
            }
            default:
                break;
        }
        // Always forward to lobby bus so feature hooks remain reactive
        this.busPublish(message);
    }
    broadcastParticipants(context = 'participants-sync') {
        this.participants.broadcast(context);
    }
}
