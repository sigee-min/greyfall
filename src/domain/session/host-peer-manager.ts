import type { RTCBridgeEvents } from '../../rtc/webrtc';
import { applyAnswerCodeToPeer, createHostPeer, createOfferCodeForPeer } from '../../rtc/webrtc';

export type HostPeer = {
  peerId: string;
  peer: RTCPeerConnection;
  channel: RTCDataChannel;
};

export type HostPeerManagerEvents = RTCBridgeEvents & {
  onPeerCreated?: (peer: HostPeer) => void;
  onPeerClosed?: (peerId: string) => void;
};

export class HostPeerManager {
  private peers = new Map<string, HostPeer>();
  constructor(private events: HostPeerManagerEvents) {}

  has(peerId: string) {
    return this.peers.has(peerId);
  }

  get(peerId: string) {
    return this.peers.get(peerId) ?? null;
  }

  async create(peerId: string) {
    if (this.peers.has(peerId)) return this.peers.get(peerId)!;
    const { peer, channel } = createHostPeer(this.events);
    const entry: HostPeer = { peerId, peer, channel };
    this.peers.set(peerId, entry);
    this.events.onPeerCreated?.(entry);
    return entry;
  }

  async close(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    try {
      entry.channel.close();
    } catch (_err) {
      void 0; // noop
    }
    try {
      entry.peer.close();
    } catch (_err) {
      void 0; // noop
    }
    this.peers.delete(peerId);
    this.events.onPeerClosed?.(peerId);
  }

  async createOffer(peerId: string, options?: RTCOfferOptions) {
    const entry = this.peers.get(peerId);
    if (!entry) throw new Error(`Peer not found: ${peerId}`);
    return createOfferCodeForPeer(entry.peer, options);
  }

  async applyAnswer(peerId: string, answerCode: string) {
    const entry = this.peers.get(peerId);
    if (!entry) throw new Error(`Peer not found: ${peerId}`);
    await applyAnswerCodeToPeer(entry.peer, answerCode);
  }

  forEach(callback: (peer: HostPeer) => void) {
    this.peers.forEach(callback);
  }

  sendAll(payload: unknown) {
    const data = JSON.stringify(payload);
    this.peers.forEach(({ channel }) => {
      if (channel.readyState === 'open') {
        channel.send(data);
      }
    });
  }
}
