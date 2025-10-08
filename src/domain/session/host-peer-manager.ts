import type { RTCBridgeEvents } from '../../rtc/webrtc';
import { applyAnswerCodeToPeer, createHostPeer, createOfferCodeForPeer } from '../../rtc/webrtc';
import { netBus } from '../../bus/net-bus.js';
import { getQueuePolicy } from '../net-objects/policies.js';

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
  private readonly queuePolicy = getQueuePolicy();
  private drains = new Map<string, EventListener>();
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
    const drain: EventListener = () => this.flush(peerId);
    try { channel.addEventListener('bufferedamountlow', drain); } catch { /* ignore */ }
    this.drains.set(peerId, drain);
    this.events.onPeerCreated?.(entry);
    return entry;
  }

  async close(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    // detach backpressure handler if present
    const drain = this.drains.get(peerId);
    if (drain) {
      try { entry.channel.removeEventListener('bufferedamountlow', drain); } catch {}
      this.drains.delete(peerId);
    }
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
    const threshold = channel.bufferedAmountLowThreshold ?? this.queuePolicy.baseThreshold;
    if (buffered > threshold * this.queuePolicy.highWaterFactor) {
      // queue
      const q = this.pending.get(peerId) ?? [];
      if (q.length >= this.queuePolicy.maxQueue) {
        q.shift();
      }
      q.push(data);
      this.pending.set(peerId, q);
      try { netBus.publish('net:queue:enqueue', { peerId, size: q.length }); } catch {}
      return;
    }
    try {
      channel.send(data);
    } catch {
      // enqueue on failure
      const q = this.pending.get(peerId) ?? [];
      if (q.length >= this.queuePolicy.maxQueue) {
        q.shift();
      }
      q.push(data);
      this.pending.set(peerId, q);
      try { netBus.publish('net:queue:enqueue', { peerId, size: q.length }); } catch {}
    }
  }

  private flush(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    const { channel } = entry;
    if (channel.readyState !== 'open') return;
    const q = this.pending.get(peerId);
    if (!q || q.length === 0) return;
    const threshold = channel.bufferedAmountLowThreshold ?? this.queuePolicy.baseThreshold;
    while (q.length > 0) {
      const buffered = channel.bufferedAmount ?? 0;
      if (buffered > threshold * this.queuePolicy.flushFactor) break;
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
    try { netBus.publish('net:queue:flush', { peerId, size: q?.length ?? 0 }); } catch {}
  }
}
