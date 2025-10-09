import { parseLobbyMessage } from '../../protocol/index.js';
import { CHAT_OBJECT_ID } from './chat.js';
import { WORLD_POSITIONS_OBJECT_ID, PARTY_OBJECT_ID } from './object-ids.js';
import { getLimiter } from './policies.js';
import { PeerParticipantMap } from './peer-map.js';
import { dispatchSyncModelCommand } from './sync-model.js';
import { removeCharacterLoadout } from '../character/character-sync.js';
import { publishParticipantsSnapshot } from '../session/participants-sync.js';
const DEBUG_NET = Boolean(import.meta?.env?.VITE_NET_DEBUG);
export class HostRouter {
    // Travel voting moved to world:travel control model
    constructor(args) {
        this.map = new PeerParticipantMap();
        this.registry = new Map();
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
        this.chat = this.require(CHAT_OBJECT_ID);
        // LLM progress removed
        this.world = this.require(WORLD_POSITIONS_OBJECT_ID);
        this.party = this.require(PARTY_OBJECT_ID);
    }
    register(object) {
        this.registry.set(object.id, object);
        if (!this.objects.has(object.id)) {
            this.objects.set(object.id, object);
        }
    }
    addNetObject(descriptor, object) {
        if (!this.descriptors.some((entry) => entry.id === descriptor.id)) {
            this.descriptors.push(descriptor);
        }
        this.register(object);
    }
    require(id) {
        const object = this.registry.get(id);
        if (!object) {
            throw new Error(`HostRouter missing host object "${id}"`);
        }
        return object;
    }
    onPeerConnected(_peerId) {
        for (const descriptor of this.descriptors) {
            const object = this.registry.get(descriptor.id);
            if (!object)
                continue;
            if (descriptor.host.onPeerConnect) {
                descriptor.host.onPeerConnect(object, this.commonDeps);
            }
        }
    }
    onPeerDisconnected(peerId) {
        const participantId = this.map.getParticipant(peerId);
        if (!participantId)
            return;
        this.map.removeByPeer(peerId);
        this.lobbyStore.remove(participantId);
        publishParticipantsSnapshot(this.lobbyStore, 'participants:peer-disconnect');
        removeCharacterLoadout(participantId, 'character:peer-disconnect');
    }
    updateParticipantReady(participantId, ready, context = 'ready:host-toggle') {
        const raw = this.lobbyStore.snapshotWire().map((p) => (p.id === participantId ? { ...p, ready } : p));
        this.lobbyStore.replaceFromWire(raw);
        publishParticipantsSnapshot(this.lobbyStore, context);
    }
    handle(payload, peerId) {
        const message = parseLobbyMessage(payload);
        if (!message)
            return;
        const senderId = peerId ? this.map.getParticipant(peerId) : this.lobbyStore.localParticipantIdRef.current;
        if (dispatchSyncModelCommand(message, { peerId, senderId, lobbyStore: this.lobbyStore, router: this })) {
            return;
        }
        try {
            switch (message.kind) {
                case 'object:request': {
                    const { id, sinceRev } = message.body;
                    if (peerId && !this.limiter.allow(`request:${peerId}:${id}`)) {
                        if (DEBUG_NET)
                            console.warn('[object:request] rate limited', { peerId, id });
                        break;
                    }
                    this.registry.get(id)?.onRequest(sinceRev);
                    break;
                }
                case 'object:ack': {
                    const { id, rev } = message.body;
                    if (DEBUG_NET)
                        console.debug('[object:ack] recv', { id, rev, peerId });
                    this.onAck?.(peerId, String(id), Number(rev));
                    break;
                }
                default:
                    break;
            }
        }
        catch (err) {
            console.error('[host-router] handle failed', { err });
        }
        this.publishToBus(message);
    }
}
