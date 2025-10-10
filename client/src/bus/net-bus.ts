import { createEventBus } from './create-event-bus';

export type NetBusEvents = {
  'net:ack:scheduled': { peerId?: string; objectId: string; rev: number; attempt: number };
  'net:ack:fallback': { peerId?: string; objectId: string; rev: number; strategy: 'incremental' | 'snapshot' | 'onRequest' | 'none' };
  'net:ack:resolved': { peerId?: string; objectId: string; rev: number };
  'net:queue:enqueue': { peerId: string; size: number };
  'net:queue:flush': { peerId: string; size: number };
  // client-side patch telemetry
  'client:patch:queued': { objectId: string; rev: number; queuedCount: number };
  'client:patch:applied': { objectId: string; rev: number };
  'client:patch:rejected': { objectId: string; rev: number };
  'client:patch:stalled': { objectId: string; sinceRev?: number };
  // domain telemetry (optional)
  'equip:request': { actorId: string; key: string };
  'equip:publishFailed': { actorId: string; key: string };
  'equip:applied': { actorId: string; key: string; effectsHash?: string };
  'equip:rejected': { actorId: string; key: string; reason: 'unauthorized' | 'cooldown' | 'unavailable' };
};

const bus = createEventBus<NetBusEvents>();

export const netBus = bus;

export type NetBus = typeof bus;
