import { HostParticipantsObject } from './participants-host.js';
import { HostChatObject } from './chat-host.js';
import { HostRouter } from './host-router.js';
export class HostNetController {
    constructor({ publish, lobbyStore, busPublish }) {
        this.ackTimers = new Map();
        this.lastSent = new Map();
        // wrap publish to track object acks
        this.publish = ((kind, body, ctx) => {
            const ok = publish(kind, body, ctx);
            if (kind === 'object:replace' || kind === 'object:patch') {
                const b = body;
                const id = String(b.id);
                const rev = Number(b.rev);
                this.lastSent.set(id, rev);
                this.scheduleAck(id, rev);
            }
            return ok;
        });
        this.lobbyStore = lobbyStore;
        this.busPublish = busPublish;
        this.participants = new HostParticipantsObject({ publish: this.publish, lobbyStore: this.lobbyStore });
        this.chat = new HostChatObject({ publish: this.publish, lobbyStore: this.lobbyStore });
        this.router = new HostRouter({
            send: (kind, body, ctx) => this.publish(kind, body, ctx),
            lobbyStore: this.lobbyStore,
            publishToBus: (message) => this.busPublish(message),
            participants: this.participants,
            chat: this.chat,
            limiter: undefined,
            onAck: (id, rev) => this.resolveAck(id, rev)
        });
    }
    bindChannel(channel, peerId) {
        const onMessage = (event) => {
            let payload = event.data;
            try {
                payload = JSON.parse(event.data);
            }
            catch (_err) {
                // ignore non-JSON payloads
            }
            this.router.handle(payload, peerId);
        };
        channel.addEventListener('message', onMessage);
    }
    onPeerConnected(peerId) {
        this.router.onPeerConnected(peerId);
    }
    // Message handling moved into HostRouter
    broadcastParticipants(context = 'participants-sync') {
        this.participants.broadcast(context);
    }
    register(object) {
        this.router.register(object);
    }
    onPeerDisconnected(peerId) {
        this.router.onPeerDisconnected(peerId);
    }
    updateParticipantReady(participantId, ready, context = 'ready:host-toggle') {
        this.router.updateParticipantReady(participantId, ready, context);
    }
    scheduleAck(id, rev, attempt = 1) {
        const key = `${id}:${rev}`;
        if (this.ackTimers.has(key)) {
            clearTimeout(this.ackTimers.get(key));
        }
        const timeout = Math.min(5000, 1000 * attempt); // linear backoff up to 5s
        const timer = setTimeout(() => {
            const last = this.lastSent.get(id);
            if (last !== rev)
                return; // newer rev sent
            // resend snapshot for this object
            if (id === 'participants')
                this.participants.broadcast('ack:resend');
            else if (id === 'chatlog')
                this.chat.onRequest(undefined);
            // schedule next attempt (max 3)
            if (attempt < 3)
                this.scheduleAck(id, rev, attempt + 1);
            else
                this.ackTimers.delete(key);
        }, timeout);
        this.ackTimers.set(key, timer);
    }
    resolveAck(id, rev) {
        const last = this.lastSent.get(id);
        if (last !== rev)
            return;
        const key = `${id}:${rev}`;
        const t = this.ackTimers.get(key);
        if (t)
            clearTimeout(t);
        this.ackTimers.delete(key);
    }
}
