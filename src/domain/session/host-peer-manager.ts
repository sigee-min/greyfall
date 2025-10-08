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
  private pending = new Map<string, string[]>();
  private readonly maxQueue = 256;
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
    // Attach backpressure listener to drain per-peer queue
    const drain = () => this.flush(peerId);
    channel.addEventListener?.('bufferedamountlow', drain as EventListener);
    this.events.onPeerCreated?.(entry);
    return entry;
  }

  async close(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    try {
      entry.channel.close();
    } catch {
      // ignore close errors
    }
    try {
      entry.peer.close();
    } catch {
      // ignore close errors
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
    this.peers.forEach(({ peerId }) => {
      this.sendTo(peerId, data);
    });
  }

  listPeerIds(): string[] {
    return [...this.peers.keys()];
  }

  sendToPeer(peerId: string, payload: unknown): boolean {
    try {
      const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
      this.sendTo(peerId, data);
      return true;
    } catch {
      return false;
    }
  }

  private sendTo(peerId: string, data: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    const { channel } = entry;
    if (channel.readyState !== 'open') return; // do not queue closed channels for now
    const buffered = channel.bufferedAmount ?? 0;
    const threshold = channel.bufferedAmountLowThreshold ?? 64 * 1024;
    if (buffered > threshold * 4) {
      // queue
      const q = this.pending.get(peerId) ?? [];
      if (q.length >= this.maxQueue) {
        q.shift();
      }
      q.push(data);
      this.pending.set(peerId, q);
      return;
    }
    try {
      channel.send(data);
    } catch {
      // enqueue on failure
      const q = this.pending.get(peerId) ?? [];
      if (q.length >= this.maxQueue) {
        q.shift();
      }
      q.push(data);
      this.pending.set(peerId, q);
    }
  }

  private flush(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    const { channel } = entry;
    if (channel.readyState !== 'open') return;
    const q = this.pending.get(peerId);
    if (!q || q.length === 0) return;
    const threshold = channel.bufferedAmountLowThreshold ?? 64 * 1024;
    while (q.length > 0) {
      const buffered = channel.bufferedAmount ?? 0;
      if (buffered > threshold * 2) break;
      const next = q.shift()!;
      try {
        channel.send(next);
      } catch {
        // push back and break
        q.unshift(next);
        break;
      }
    }
    if (q.length === 0) this.pending.delete(peerId);
  }
}
