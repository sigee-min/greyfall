export class PeerParticipantMap {
    constructor() {
        this.peerToParticipant = new Map();
        this.participantToPeer = new Map();
    }
    set(peerId, participantId) {
        this.peerToParticipant.set(peerId, participantId);
        this.participantToPeer.set(participantId, peerId);
    }
    removeByPeer(peerId) {
        const pid = this.peerToParticipant.get(peerId);
        if (pid)
            this.participantToPeer.delete(pid);
        this.peerToParticipant.delete(peerId);
    }
    removeByParticipant(participantId) {
        const peer = this.participantToPeer.get(participantId);
        if (peer)
            this.peerToParticipant.delete(peer);
        this.participantToPeer.delete(participantId);
    }
    getParticipant(peerId) {
        return this.peerToParticipant.get(peerId);
    }
    getPeer(participantId) {
        return this.participantToPeer.get(participantId);
    }
}
