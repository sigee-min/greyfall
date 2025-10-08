import { HostValueObject } from './base/value-object.js';
import { HostListObject } from './base/list-object.js';
import { HostKeyedListObject } from './base/keyed-list-object.js';
export var HostAckFallback;
(function (HostAckFallback) {
    HostAckFallback["Snapshot"] = "snapshot";
    HostAckFallback["OnRequest"] = "onRequest";
    HostAckFallback["None"] = "none";
})(HostAckFallback || (HostAckFallback = {}));
const descriptors = new Map();
const descriptorListeners = new Set();
const hostInstances = new Map();
const hostInstanceListeners = new Map();
const clientInstances = new Map();
const clientInstanceListeners = new Map();
export function registerNetObject(descriptor) {
    if (descriptors.has(descriptor.id)) {
        try {
            // Use Vite's import.meta.env when available to avoid Node typings
            const isProd = import.meta?.env?.MODE === 'production';
            if (!isProd) {
                console.warn('[net-object] duplicate registration ignored', descriptor.id);
            }
        }
        catch { }
        return descriptors.get(descriptor.id);
    }
    descriptors.set(descriptor.id, descriptor);
    for (const listener of descriptorListeners) {
        listener(descriptor);
    }
    return descriptor;
}
export function getNetObjectDescriptors() {
    return Array.from(descriptors.values());
}
export function getNetObjectDescriptor(id) {
    return descriptors.get(id);
}
export function subscribeNetObjectDescriptors(listener) {
    descriptorListeners.add(listener);
    return () => descriptorListeners.delete(listener);
}
export function attachHostObject(object) {
    hostInstances.set(object.id, object);
    const listeners = hostInstanceListeners.get(object.id);
    if (listeners) {
        for (const listener of listeners) {
            listener(object);
        }
    }
}
export function detachHostObject(id, object) {
    if (!hostInstances.has(id))
        return;
    if (object && hostInstances.get(id) !== object)
        return;
    hostInstances.delete(id);
}
export function getHostObject(id) {
    return hostInstances.get(id) ?? null;
}
export function onHostObjectAvailable(id, listener) {
    const existing = getHostObject(id);
    if (existing) {
        listener(existing);
        return () => { };
    }
    const set = hostInstanceListeners.get(id) ?? new Set();
    const wrapped = (obj) => listener(obj);
    set.add(wrapped);
    hostInstanceListeners.set(id, set);
    return () => {
        const current = hostInstanceListeners.get(id);
        if (!current)
            return;
        current.delete(wrapped);
        if (current.size === 0)
            hostInstanceListeners.delete(id);
    };
}
export function attachClientObject(object) {
    clientInstances.set(object.id, object);
    const listeners = clientInstanceListeners.get(object.id);
    if (listeners) {
        for (const listener of listeners) {
            listener(object);
        }
    }
}
export function detachClientObject(id, object) {
    if (!clientInstances.has(id))
        return;
    if (object && clientInstances.get(id) !== object)
        return;
    clientInstances.delete(id);
}
export function getClientObject(id) {
    return clientInstances.get(id) ?? null;
}
export function onClientObjectAvailable(id, listener) {
    const existing = getClientObject(id);
    if (existing) {
        listener(existing);
        return () => { };
    }
    const set = clientInstanceListeners.get(id) ?? new Set();
    const wrapped = (obj) => listener(obj);
    set.add(wrapped);
    clientInstanceListeners.set(id, set);
    return () => {
        const current = clientInstanceListeners.get(id);
        if (!current)
            return;
        current.delete(wrapped);
        if (current.size === 0)
            clientInstanceListeners.delete(id);
    };
}
function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
function applyValueOps(base, ops) {
    let result = base !== null ? cloneValue(base) : null;
    for (const op of ops) {
        if (!op || typeof op !== 'object')
            continue;
        if (op.op === 'set') {
            result = op.value ?? null;
        }
        else if (op.op === 'merge') {
            const value = op.value ?? {};
            if (result && typeof result === 'object') {
                result = { ...result, ...value };
            }
            else {
                result = cloneValue(value);
            }
        }
    }
    return result;
}
export class ClientValueAdapter {
    constructor(id, transform) {
        this.value = null;
        this.rev = 0;
        this.listeners = new Set();
        this.id = id;
        this.transform = transform;
    }
    onReplace(rev, value) {
        if (rev <= this.rev)
            return;
        const next = this.transform ? this.transform(value) : value;
        this.rev = rev;
        this.value = next ?? null;
        this.emit();
    }
    onPatch(rev, ops) {
        if (rev <= this.rev)
            return;
        const next = applyValueOps(this.value, Array.isArray(ops) ? ops : []);
        this.rev = rev;
        this.value = next;
        this.emit();
    }
    getValue() {
        return this.value;
    }
    getRev() {
        return this.rev;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.value, this.rev);
        return () => this.listeners.delete(listener);
    }
    emit() {
        for (const listener of this.listeners) {
            listener(this.value, this.rev);
        }
    }
}
function applyListOps(path, baseList, ops) {
    const container = { [path]: baseList.map((item) => cloneValue(item)) };
    for (const op of ops) {
        if (!op || typeof op !== 'object')
            continue;
        const kind = op.op;
        if (kind === 'set') {
            const value = op.value;
            if (Array.isArray(value?.[path])) {
                container[path] = value[path].map((item) => cloneValue(item));
            }
        }
        else if (kind === 'merge' && op.path === path) {
            const value = op.value;
            const items = Array.isArray(value) ? value : [value];
            for (const item of items) {
                container[path].push(cloneValue(item));
            }
        }
        else if (kind === 'insert' && op.path === path) {
            const value = op.value;
            if (Array.isArray(value))
                container[path].push(...value.map((item) => cloneValue(item)));
            else
                container[path].push(cloneValue(value));
        }
        else if (kind === 'remove' && op.path === path) {
            const value = op.value;
            if (typeof value === 'number') {
                container[path].splice(value, 1);
            }
        }
    }
    return container[path];
}
function applyKeyedListOps(path, baseList, ops) {
    const list = baseList.map((item) => cloneValue(item));
    for (const op of ops) {
        if (!op || typeof op !== 'object')
            continue;
        const kind = op.op;
        if (kind === 'set') {
            const value = op.value;
            if (Array.isArray(value?.[path])) {
                return value[path].map((item) => cloneValue(item));
            }
        }
        else if (kind === 'merge' && op.path === path) {
            const value = op.value;
            const items = Array.isArray(value) ? value : [value];
            for (const patch of items) {
                const id = patch?.id;
                if (!id)
                    continue;
                const idx = list.findIndex((item) => item.id === id);
                if (idx >= 0) {
                    list[idx] = { ...list[idx], ...cloneValue(patch) };
                }
                else {
                    list.push(cloneValue(patch));
                }
            }
        }
        else if (kind === 'remove' && op.path === path) {
            const value = op.value;
            if (typeof value === 'object' && value && 'id' in value) {
                const id = value.id;
                const idx = list.findIndex((item) => item.id === id);
                if (idx >= 0)
                    list.splice(idx, 1);
            }
            else if (typeof value === 'number') {
                list.splice(value, 1);
            }
        }
    }
    return list;
}
export class ClientListAdapter {
    constructor(id, path = 'entries', hydrate) {
        this.list = [];
        this.rev = 0;
        this.listeners = new Set();
        this.id = id;
        this.path = path;
        this.hydrate = hydrate;
    }
    onReplace(rev, value) {
        if (rev <= this.rev)
            return;
        const list = Array.isArray(value?.[this.path]) ? value[this.path] : [];
        this.rev = rev;
        this.list = list.map((item) => this.makeItem(item));
        this.emit();
    }
    onPatch(rev, ops) {
        if (rev <= this.rev)
            return;
        const next = applyListOps(this.path, this.list, Array.isArray(ops) ? ops : []);
        this.rev = rev;
        this.list = next.map((item) => this.makeItem(item));
        this.emit();
    }
    getList() {
        return this.list.slice();
    }
    getRev() {
        return this.rev;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getList(), this.rev);
        return () => this.listeners.delete(listener);
    }
    makeItem(raw) {
        return this.hydrate ? this.hydrate(raw) : raw;
    }
    emit() {
        const snapshot = this.getList();
        for (const listener of this.listeners) {
            listener(snapshot, this.rev);
        }
    }
}
export class ClientKeyedListAdapter {
    constructor(id, path = 'list', hydrate) {
        this.list = [];
        this.rev = 0;
        this.listeners = new Set();
        this.id = id;
        this.path = path;
        this.hydrate = hydrate;
    }
    onReplace(rev, value) {
        if (rev <= this.rev)
            return;
        const list = Array.isArray(value?.[this.path]) ? value[this.path] : [];
        this.rev = rev;
        this.list = list.map((item) => this.makeItem(item));
        this.emit();
    }
    onPatch(rev, ops) {
        if (rev <= this.rev)
            return;
        const next = applyKeyedListOps(this.path, this.list, Array.isArray(ops) ? ops : []);
        this.rev = rev;
        this.list = next.map((item) => this.makeItem(item));
        this.emit();
    }
    getList() {
        return this.list.slice();
    }
    getRev() {
        return this.rev;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.getList(), this.rev);
        return () => this.listeners.delete(listener);
    }
    makeItem(raw) {
        return this.hydrate ? this.hydrate(raw) : raw;
    }
    emit() {
        const snapshot = this.getList();
        for (const listener of this.listeners) {
            listener(snapshot, this.rev);
        }
    }
}
export function defineValueNetObject(options) {
    const clientAdapter = new ClientValueAdapter(options.id, options.client?.transform);
    const descriptor = {
        id: options.id,
        host: {
            create: (deps) => new HostValueObject(deps, options.id, options.initial, options.host?.initContext),
            ack: options.host?.ack ?? { incrementalMax: 1, fallbackStrategy: HostAckFallback.Snapshot },
            onPeerConnect: (object, deps) => {
                if (options.host?.onPeerConnect) {
                    options.host.onPeerConnect(object, deps);
                }
                else {
                    object.onRequest(undefined);
                }
            }
        },
        client: {
            create: () => clientAdapter,
            requestOnStart: options.client?.requestOnStart ?? true,
            requestContext: options.client?.requestContext ?? `request ${options.id}`
        }
    };
    registerNetObject(descriptor);
    return {
        id: options.id,
        host: {
            getObject: () => getHostObject(options.id),
            set: (value, context) => getHostObject(options.id)?.set(value, context),
            merge: (partial, context) => getHostObject(options.id)?.merge(partial, context)
        },
        client: clientAdapter
    };
}
export function defineListNetObject(options) {
    const path = options.path ?? 'entries';
    const clientAdapter = new ClientListAdapter(options.id, path, options.client?.hydrate);
    const descriptor = {
        id: options.id,
        host: {
            create: (deps) => new HostListObject(deps, options.id, {
                path,
                initial: options.initial,
                max: options.max,
                context: options.host?.initContext
            }),
            ack: options.host?.ack ?? { incrementalMax: 32, fallbackStrategy: HostAckFallback.Snapshot },
            onPeerConnect: (object, deps) => {
                if (options.host?.onPeerConnect) {
                    options.host.onPeerConnect(object, deps);
                }
                else {
                    object.onRequest(undefined);
                }
            }
        },
        client: {
            create: () => clientAdapter,
            requestOnStart: options.client?.requestOnStart ?? true,
            requestContext: options.client?.requestContext ?? `request ${options.id}`
        }
    };
    registerNetObject(descriptor);
    return {
        id: options.id,
        host: {
            getObject: () => getHostObject(options.id),
            append: (item, context) => getHostObject(options.id)?.append(item, context),
            replaceAll: (items, context) => getHostObject(options.id)?.replaceAll(items, context)
        },
        client: clientAdapter
    };
}
export function defineKeyedListNetObject(options) {
    const path = options.path ?? 'list';
    const clientAdapter = new ClientKeyedListAdapter(options.id, path, options.client?.hydrate);
    const descriptor = {
        id: options.id,
        host: {
            create: (deps) => new HostKeyedListObject(deps, options.id, {
                path,
                initial: options.initial,
                context: options.host?.initContext
            }),
            ack: options.host?.ack ?? { incrementalMax: 32, fallbackStrategy: HostAckFallback.Snapshot },
            onPeerConnect: (object, deps) => {
                if (options.host?.onPeerConnect) {
                    options.host.onPeerConnect(object, deps);
                }
                else {
                    object.onRequest(undefined);
                }
            }
        },
        client: {
            create: () => clientAdapter,
            requestOnStart: options.client?.requestOnStart ?? true,
            requestContext: options.client?.requestContext ?? `request ${options.id}`
        }
    };
    registerNetObject(descriptor);
    return {
        id: options.id,
        host: {
            getObject: () => getHostObject(options.id),
            upsertMany: (entries, context) => getHostObject(options.id)?.upsertMany(entries, context),
            removeById: (entryId, context) => getHostObject(options.id)?.removeById(entryId, context)
        },
        client: clientAdapter
    };
}
