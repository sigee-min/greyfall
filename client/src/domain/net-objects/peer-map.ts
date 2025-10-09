export class PeerParticipantMap {
  private peerToParticipant = new Map<string, string>();
  private participantToPeer = new Map<string, string>();

  set(peerId: string, participantId: string) {
    this.peerToParticipant.set(peerId, participantId);
    this.participantToPeer.set(participantId, peerId);
  }

  removeByPeer(peerId: string) {
    const pid = this.peerToParticipant.get(peerId);
    if (pid) this.participantToPeer.delete(pid);
    this.peerToParticipant.delete(peerId);
  }

  removeByParticipant(participantId: string) {
    const peer = this.participantToPeer.get(participantId);
    if (peer) this.peerToParticipant.delete(peer);
    this.participantToPeer.delete(participantId);
  }

  getParticipant(peerId: string): string | undefined {
    return this.peerToParticipant.get(peerId);
  }

  getPeer(participantId: string): string | undefined {
    return this.participantToPeer.get(participantId);
  }
}

