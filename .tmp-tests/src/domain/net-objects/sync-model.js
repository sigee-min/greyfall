import { useSyncExternalStore } from 'react';
import { HostReplicator } from './replicator.js';
import { registerNetObject, HostAckFallback, attachClientObject, attachHostObject } from './registry.js';
const DEFAULT_EQUALITY = (a, b) => Object.is(a, b);
const clientStores = new Map();
const syncCommandHandlers = new Map();
const hostRefs = new Map();
export function defineSyncModel(config) {
    return config;
}
export function registerSyncModel(model) {
    const equality = model.equality ?? DEFAULT_EQUALITY;
    ensureClientStore(model.id, model.initial(), equality);
    const hostRef = ensureHostRef(model.id);
    registerNetObject({
        id: model.id,
        host: {
            create: (deps) => new HostSyncModelObject(model, deps, hostRef),
            ack: {
                incrementalMax: model.incrementalMax ?? 32,
                fallbackStrategy: model.ackFallback ?? HostAckFallback.Snapshot
            },
            onPeerConnect: (object) => object.onRequest(undefined)
        },
        client: {
            create: (deps) => (model.clientFactory ? model.clientFactory(deps, model) : new ClientSyncModelObject(model)),
            requestOnStart: model.requestOnStart ?? true,
            requestContext: `request ${model.id}`
        }
    });
    const hostApi = {
        set: (value, context = 'sync:set') => enqueueHost(hostRef, (host) => host.setValue(value, context)),
        update: (updater, context = 'sync:update') => enqueueHost(hostRef, (host) => host.setValue(updater(host.getValue()), context)),
        get: () => hostRef.current?.getValue() ?? model.initial(),
        requestSnapshot: (since) => enqueueHost(hostRef, (host) => host.requestSnapshot(since)),
        onReady: (listener) => {
            hostRef.listeners.add(listener);
            if (hostRef.current) {
                listener(hostApi);
            }
            return () => hostRef.listeners.delete(listener);
        }
    };
    const use = (selector) => {
        const sel = selector ?? ((data) => data);
        const store = getClientStore(model.id);
        return useSyncExternalStore((listener) => {
            store.listeners.add(listener);
            return () => store.listeners.delete(listener);
        }, () => sel(store.value), () => sel(store.value));
    };
    const registration = {
        id: model.id,
        initial: model.initial,
        host: hostApi,
        use
    };
    if (model.commands) {
        for (const command of model.commands) {
            registerSyncModelCommand(model.id, command, hostApi);
        }
    }
    return registration;
}
function ensureClientStore(id, initial, equality) {
    if (clientStores.has(id)) {
        return clientStores.get(id);
    }
    const store = {
        value: initial,
        listeners: new Set(),
        equality
    };
    clientStores.set(id, store);
    return store;
}
function getClientStore(id) {
    const store = clientStores.get(id);
    if (!store) {
        throw new Error(`SyncModel client store missing for id=${id}`);
    }
    return store;
}
function ensureHostRef(id) {
    if (hostRefs.has(id)) {
        return hostRefs.get(id);
    }
    const ref = {
        current: null,
        queue: [],
        listeners: new Set()
    };
    hostRefs.set(id, ref);
    return ref;
}
function enqueueHost(ref, op) {
    const host = ref.current;
    if (host) {
        op(host);
        return true;
    }
    ref.queue.push(op);
    return true;
}
class HostSyncModelObject {
    constructor(model, deps, ref) {
        this.model = model;
        this.deps = deps;
        this.ref = ref;
        this.id = model.id;
        this.replicator = new HostReplicator((kind, body, context) => deps.publish(kind, body, context));
        this.current = model.initial();
        this.persist('sync:init');
        this.ref.current = this;
        const queue = [...this.ref.queue];
        this.ref.queue.length = 0;
        for (const op of queue)
            op(this);
        for (const listener of this.ref.listeners)
            listener(createHostApi(this, this.ref));
        attachHostObject(this);
    }
    setValue(value, context) {
        if (this.model.equality && this.model.equality(this.current, value))
            return;
        this.current = value;
        this.persist(context);
    }
    getValue() {
        return this.current;
    }
    onRequest(sinceRev) {
        return this.replicator.onRequest(this.id, sinceRev, 'sync:request');
    }
    requestSnapshot(sinceRev) {
        return this.replicator.onRequest(this.id, sinceRev, 'sync:manual-request');
    }
    getSnapshot() {
        return this.replicator.get(this.id);
    }
    getLogsSince(sinceRev) {
        return this.replicator.getLogsSince(this.id, sinceRev);
    }
    persist(context) {
        const serialized = this.model.serialize ? this.model.serialize(this.current) : this.current;
        this.replicator.set(this.id, serialized, context);
        updateClientStore(this.id, this.current, this.model.equality ?? DEFAULT_EQUALITY);
    }
}
class ClientSyncModelObject {
    constructor(model) {
        this.model = model;
        this.id = model.id;
        attachClientObject(this);
    }
    onReplace(_rev, value) {
        const parsed = this.parse(value);
        if (parsed == null)
            return;
        updateClientStore(this.id, parsed, this.model.equality ?? DEFAULT_EQUALITY);
    }
    onPatch() {
        // use replace semantics for now
    }
    parse(value) {
        if (this.model.deserialize) {
            return this.model.deserialize(value);
        }
        return value;
    }
}
function createHostApi(host, ref) {
    return {
        set: (value, context = 'sync:set') => {
            host.setValue(value, context);
            return true;
        },
        update: (updater, context = 'sync:update') => {
            host.setValue(updater(host.getValue()), context);
            return true;
        },
        get: () => host.getValue(),
        requestSnapshot: (sinceRev) => {
            host.requestSnapshot(sinceRev);
            return true;
        },
        onReady: (listener) => {
            ref.listeners.add(listener);
            listener(createHostApi(host, ref));
            return () => ref.listeners.delete(listener);
        }
    };
}
function registerSyncModelCommand(modelId, command, host) {
    const kind = command.kind;
    if (syncCommandHandlers.has(kind)) {
        console.warn(`[sync-model] duplicate command registration for ${kind}`);
    }
    syncCommandHandlers.set(kind, (runtime) => {
        const payload = command.parse(runtime.message.body);
        if (payload == null)
            return false;
        if (command.authorize && !command.authorize({ payload, peerId: runtime.peerId, senderId: runtime.senderId, lobbyStore: runtime.lobbyStore })) {
            console.warn(`[sync-model] command ${kind} unauthorized`, { sender: runtime.senderId });
            return true;
        }
        command.handle({ payload, host, context: runtime });
        return true;
    });
}
export function dispatchSyncModelCommand(message, runtime) {
    const handler = syncCommandHandlers.get(message.kind);
    if (!handler)
        return false;
    return handler({ ...runtime, message });
}
function updateClientStore(id, value, equality) {
    const store = clientStores.get(id);
    if (!store)
        return;
    if (equality(store.value, value))
        return;
    store.value = value;
    for (const listener of store.listeners)
        listener();
}
export function useSyncModel(registration, selector) {
    return registration.use(selector);
}
