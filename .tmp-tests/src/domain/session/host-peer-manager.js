import { applyAnswerCodeToPeer, createHostPeer, createOfferCodeForPeer } from '../../rtc/webrtc';
export class HostPeerManager {
    constructor(events) {
        Object.defineProperty(this, "events", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: events
        });
        Object.defineProperty(this, "peers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    has(peerId) {
        return this.peers.has(peerId);
    }
    get(peerId) {
        return this.peers.get(peerId) ?? null;
    }
    async create(peerId) {
        if (this.peers.has(peerId))
            return this.peers.get(peerId);
        const { peer, channel } = createHostPeer(this.events);
        const entry = { peerId, peer, channel };
        this.peers.set(peerId, entry);
        this.events.onPeerCreated?.(entry);
        return entry;
    }
    async close(peerId) {
        const entry = this.peers.get(peerId);
        if (!entry)
            return;
        try {
            entry.channel.close();
        }
        catch (_err) {
            void 0; // noop
        }
        try {
            entry.peer.close();
        }
        catch (_err) {
            void 0; // noop
        }
        this.peers.delete(peerId);
        this.events.onPeerClosed?.(peerId);
    }
    async createOffer(peerId, options) {
        const entry = this.peers.get(peerId);
        if (!entry)
            throw new Error(`Peer not found: ${peerId}`);
        return createOfferCodeForPeer(entry.peer, options);
    }
    async applyAnswer(peerId, answerCode) {
        const entry = this.peers.get(peerId);
        if (!entry)
            throw new Error(`Peer not found: ${peerId}`);
        await applyAnswerCodeToPeer(entry.peer, answerCode);
    }
    forEach(callback) {
        this.peers.forEach(callback);
    }
    sendAll(payload) {
        const data = JSON.stringify(payload);
        this.peers.forEach(({ channel }) => {
            if (channel.readyState === 'open') {
                channel.send(data);
            }
        });
    }
}
