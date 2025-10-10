import { parseLobbyMessage, type LobbyMessage } from '../../protocol/index.js';
import type { LobbyStore } from '../session/session-store';
import type { CommonDeps, HostObject } from './types';
import { CHAT_OBJECT_ID } from './chat.js';
import { WORLD_POSITIONS_OBJECT_ID, PARTY_OBJECT_ID } from './object-ids.js';
// LLM progress net-object removed
// import { getEntryField, getMap } from '../world/nav';
import { SlidingWindowLimiter } from './rate-limit.js';
import { getLimiter } from './policies.js';
import { PeerParticipantMap } from './peer-map.js';
import type { NetObjectDescriptor } from './registry.js';
import { dispatchSyncModelCommand } from './sync-model.js';
import { removeCharacterLoadout } from '../character/character-sync.js';
import { publishParticipantsSnapshot } from '../session/participants-sync.js';

const DEBUG_NET = Boolean((import.meta as any)?.env?.VITE_NET_DEBUG);

// Local minimal interfaces to decouple from concrete classes
type HostChatApi = {
  id: string;
  append: (entry: any, context?: string) => void;
  onRequest: (sinceRev?: number) => boolean;
};

type HostWorldPositionsApi = {
  id: string;
  ensureParticipant: (participantId: string, mapId: string) => boolean;
  movePartyToMap: (mapId: string, memberIds: string[]) => boolean;
  moveField: (playerId: string, mapId: string, fromFieldId: string, toFieldId: string) => boolean;
  onRequest: (sinceRev?: number) => boolean;
};

type HostPartyApi = {
  id: string;
  addMember: (id: string) => boolean;
  removeMember: (id: string) => boolean;
  getMembers: () => string[];
  travel: (direction?: 'next' | 'prev', toMapId?: string) => boolean;
  onRequest: (sinceRev?: number) => boolean;
};

type Publish = (message: LobbyMessage) => void;
type Send = <K extends LobbyMessage['kind']>(kind: K, body: Extract<LobbyMessage, { kind: K }>['body'], context?: string) => boolean;

export class HostRouter {
  private readonly send: Send;
  private readonly lobbyStore: LobbyStore;
  private readonly publishToBus: Publish;
  private readonly descriptors: NetObjectDescriptor[];
  private readonly commonDeps: CommonDeps;
  private readonly objects: Map<string, HostObject>;
  private readonly chat: HostChatApi;
  private readonly world: HostWorldPositionsApi;
  private readonly party: HostPartyApi;
  // private readonly llm: HostLlmProgressObject;
  private readonly limiter: SlidingWindowLimiter;
  private readonly onAck?: (peerId: string | undefined, id: string, rev: number) => void;
  private readonly map = new PeerParticipantMap();
  private readonly registry = new Map<string, HostObject>();
  // Travel voting moved to world:travel control model

  constructor(args: {
    send: Send;
    lobbyStore: LobbyStore;
    publishToBus: Publish;
    descriptors: NetObjectDescriptor[];
    objects: Map<string, HostObject>;
    commonDeps: CommonDeps;
    limiter?: SlidingWindowLimiter;
    onAck?: (peerId: string | undefined, id: string, rev: number) => void;
  }) {
    this.send = args.send;
    this.lobbyStore = args.lobbyStore;
    this.publishToBus = args.publishToBus;
    this.descriptors = [...args.descriptors];
    this.commonDeps = args.commonDeps;
    this.objects = args.objects;
    this.limiter = args.limiter ?? getLimiter('object:request');
    this.onAck = args.onAck;
    for (const object of this.objects.values()) {
      this.register(object);
    }
    this.chat = this.require<HostChatApi>(CHAT_OBJECT_ID);
    // LLM progress removed
    this.world = this.require<HostWorldPositionsApi>(WORLD_POSITIONS_OBJECT_ID);
    this.party = this.require<HostPartyApi>(PARTY_OBJECT_ID);
  }

  register(object: HostObject) {
    this.registry.set(object.id, object);
    if (!this.objects.has(object.id)) {
      this.objects.set(object.id, object);
    }
  }

  addNetObject(descriptor: NetObjectDescriptor, object: HostObject) {
    if (!this.descriptors.some((entry) => entry.id === descriptor.id)) {
      this.descriptors.push(descriptor);
    }
    this.register(object);
  }

  private require<T extends HostObject>(id: string): T {
    const object = this.registry.get(id);
    if (!object) {
      throw new Error(`HostRouter missing host object "${id}"`);
    }
    return object as T;
  }

  onPeerConnected(_peerId: string) {
    for (const descriptor of this.descriptors) {
      const object = this.registry.get(descriptor.id);
      if (!object) continue;
      if (descriptor.host.onPeerConnect) {
        descriptor.host.onPeerConnect(object, this.commonDeps);
      }
    }
  }

  onPeerDisconnected(peerId: string) {
    const participantId = this.map.getParticipant(peerId);
    if (!participantId) return;
    this.map.removeByPeer(peerId);
    this.lobbyStore.remove(participantId);
    publishParticipantsSnapshot(this.lobbyStore, 'participants:peer-disconnect');
    removeCharacterLoadout(participantId, 'character:peer-disconnect');
  }

  updateParticipantReady(participantId: string, ready: boolean, context = 'ready:host-toggle') {
    const raw = this.lobbyStore.snapshotWire().map((p) => (p.id === participantId ? { ...p, ready } : p));
    this.lobbyStore.replaceFromWire(raw);
    publishParticipantsSnapshot(this.lobbyStore, context);
  }

  handle(payload: unknown, peerId?: string) {
    const message = parseLobbyMessage(payload);
    if (!message) return;
    const senderId = peerId ? this.map.getParticipant(peerId) : this.lobbyStore.localParticipantIdRef.current;
    if (dispatchSyncModelCommand(message, { peerId, senderId, lobbyStore: this.lobbyStore, router: this })) {
      return;
    }
    try {
      switch (message.kind) {
        case 'object:request': {
          const { id, sinceRev } = message.body;
          if (peerId && !this.limiter.allow(`request:${peerId}:${id}`)) {
            if (DEBUG_NET) console.warn('[object:request] rate limited', { peerId, id });
            break;
          }
          this.registry.get(id)?.onRequest(sinceRev);
          break;
        }
        case 'object:ack': {
          const { id, rev } = message.body;
          if (DEBUG_NET) console.debug('[object:ack] recv', { id, rev, peerId });
          this.onAck?.(peerId, String(id), Number(rev));
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error('[host-router] handle failed', { err });
    }
    this.publishToBus(message);
  }

  // No travel voting logic here

  // Public method to emit lobby messages from models/handlers
  sendLobbyMessage<K extends LobbyMessage['kind']>(kind: K, body: Extract<LobbyMessage, { kind: K }>['body'], context?: string): boolean {
    return this.send(kind, body as any, context);
  }
}
