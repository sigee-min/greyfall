import { HostValueObject } from './base/value-object.js';
import { HostListObject } from './base/list-object.js';
import { HostKeyedListObject } from './base/keyed-list-object.js';
import type { CommonDeps, HostObject, ClientObject } from './types';
import type { LobbyStore } from '../session/session-store';

type HostBuilderContext = {
  get<T extends HostObject>(id: string): T | null;
};

export enum HostAckFallback {
  Snapshot = 'snapshot',
  OnRequest = 'onRequest',
  None = 'none'
}

export type HostAckPolicy = {
  incrementalMax?: number;
  fallbackStrategy?: HostAckFallback;
  broadcast?: (object: HostObject, deps: CommonDeps) => void;
};

export type HostDescriptor = {
  create: (deps: CommonDeps, ctx: HostBuilderContext) => HostObject;
  ack?: HostAckPolicy;
  onPeerConnect?: (object: HostObject, deps: CommonDeps) => void;
};

export type ClientDescriptorDeps = {
  lobbyStore: LobbyStore;
};

export type ClientDescriptor = {
  create?: (deps: ClientDescriptorDeps) => ClientObject | null;
  requestOnStart?: boolean;
  requestContext?: string;
};

export type NetObjectDescriptor = {
  id: string;
  host: HostDescriptor;
  client?: ClientDescriptor;
};

const descriptors = new Map<string, NetObjectDescriptor>();
const descriptorListeners = new Set<(descriptor: NetObjectDescriptor) => void>();

const hostInstances = new Map<string, HostObject>();
const hostInstanceListeners = new Map<string, Set<(object: HostObject) => void>>();

const clientInstances = new Map<string, ClientObject>();
const clientInstanceListeners = new Map<string, Set<(object: ClientObject) => void>>();

export function registerNetObject(descriptor: NetObjectDescriptor) {
  if (descriptors.has(descriptor.id)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[net-object] duplicate registration ignored', descriptor.id);
    }
    return descriptors.get(descriptor.id)!;
  }
  descriptors.set(descriptor.id, descriptor);
  for (const listener of descriptorListeners) {
    listener(descriptor);
  }
  return descriptor;
}

export function getNetObjectDescriptors(): NetObjectDescriptor[] {
  return Array.from(descriptors.values());
}

export function getNetObjectDescriptor(id: string): NetObjectDescriptor | undefined {
  return descriptors.get(id);
}

export function subscribeNetObjectDescriptors(listener: (descriptor: NetObjectDescriptor) => void) {
  descriptorListeners.add(listener);
  return () => descriptorListeners.delete(listener);
}

export function attachHostObject(object: HostObject) {
  hostInstances.set(object.id, object);
  const listeners = hostInstanceListeners.get(object.id);
  if (listeners) {
    for (const listener of listeners) {
      listener(object);
    }
  }
}

export function detachHostObject(id: string, object?: HostObject) {
  if (!hostInstances.has(id)) return;
  if (object && hostInstances.get(id) !== object) return;
  hostInstances.delete(id);
}

export function getHostObject<T extends HostObject>(id: string): T | null {
  return (hostInstances.get(id) as T) ?? null;
}

export function onHostObjectAvailable<T extends HostObject>(id: string, listener: (object: T) => void) {
  const existing = getHostObject<T>(id);
  if (existing) {
    listener(existing);
    return () => {};
  }
  const set = hostInstanceListeners.get(id) ?? new Set<(obj: HostObject) => void>();
  const wrapped = (obj: HostObject) => listener(obj as T);
  set.add(wrapped);
  hostInstanceListeners.set(id, set);
  return () => {
    const current = hostInstanceListeners.get(id);
    if (!current) return;
    current.delete(wrapped);
    if (current.size === 0) hostInstanceListeners.delete(id);
  };
}

export function attachClientObject(object: ClientObject) {
  clientInstances.set(object.id, object);
  const listeners = clientInstanceListeners.get(object.id);
  if (listeners) {
    for (const listener of listeners) {
      listener(object);
    }
  }
}

export function detachClientObject(id: string, object?: ClientObject) {
  if (!clientInstances.has(id)) return;
  if (object && clientInstances.get(id) !== object) return;
  clientInstances.delete(id);
}

export function getClientObject<T extends ClientObject>(id: string): T | null {
  return (clientInstances.get(id) as T) ?? null;
}

export function onClientObjectAvailable<T extends ClientObject>(id: string, listener: (object: T) => void) {
  const existing = getClientObject<T>(id);
  if (existing) {
    listener(existing);
    return () => {};
  }
  const set = clientInstanceListeners.get(id) ?? new Set<(obj: ClientObject) => void>();
  const wrapped = (obj: ClientObject) => listener(obj as T);
  set.add(wrapped);
  clientInstanceListeners.set(id, set);
  return () => {
    const current = clientInstanceListeners.get(id);
    if (!current) return;
    current.delete(wrapped);
    if (current.size === 0) clientInstanceListeners.delete(id);
  };
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyValueOps<T>(base: T | null, ops: any[]): T | null {
  let result = base !== null ? cloneValue(base) : null;
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op === 'set') {
      result = op.value ?? null;
    } else if (op.op === 'merge') {
      const value = op.value ?? {};
      if (result && typeof result === 'object') {
        result = { ...(result as any), ...(value as any) };
      } else {
        result = cloneValue(value);
      }
    }
  }
  return result;
}

export class ClientValueAdapter<T> implements ClientObject {
  readonly id: string;
  private value: T | null = null;
  private rev = 0;
  private listeners = new Set<(value: T | null, rev: number) => void>();
  private readonly transform?: (value: unknown) => T | null;

  constructor(id: string, transform?: (value: unknown) => T | null) {
    this.id = id;
    this.transform = transform;
  }

  onReplace(rev: number, value: unknown) {
    if (rev <= this.rev) return;
    const next = this.transform ? this.transform(value) : (value as T | null);
    this.rev = rev;
    this.value = next ?? null;
    this.emit();
  }

  onPatch(rev: number, ops: unknown[]) {
    if (rev <= this.rev) return;
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

  subscribe(listener: (value: T | null, rev: number) => void) {
    this.listeners.add(listener);
    listener(this.value, this.rev);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.value, this.rev);
    }
  }
}

function applyListOps<T>(path: string, baseList: T[], ops: any[]): T[] {
  const container = { [path]: baseList.map((item) => cloneValue(item)) };
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    const kind = op.op;
    if (kind === 'set') {
      const value = op.value;
      if (Array.isArray(value?.[path])) {
        container[path] = value[path].map((item: any) => cloneValue(item));
      }
    } else if (kind === 'merge' && op.path === path) {
      const value = op.value;
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        container[path].push(cloneValue(item));
      }
    } else if (kind === 'insert' && op.path === path) {
      const value = op.value;
      if (Array.isArray(value)) container[path].push(...value.map((item: any) => cloneValue(item)));
      else container[path].push(cloneValue(value));
    } else if (kind === 'remove' && op.path === path) {
      const value = op.value;
      if (typeof value === 'number') {
        container[path].splice(value, 1);
      }
    }
  }
  return container[path];
}

type WithId = { id: string };

function applyKeyedListOps<T extends WithId>(path: string, baseList: T[], ops: any[]): T[] {
  const list = baseList.map((item) => cloneValue(item));
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    const kind = op.op;
    if (kind === 'set') {
      const value = op.value;
      if (Array.isArray(value?.[path])) {
        return value[path].map((item: any) => cloneValue(item));
      }
    } else if (kind === 'merge' && op.path === path) {
      const value = op.value;
      const items = Array.isArray(value) ? value : [value];
      for (const patch of items) {
        const id = patch?.id;
        if (!id) continue;
        const idx = list.findIndex((item) => item.id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...cloneValue(patch) };
        } else {
          list.push(cloneValue(patch));
        }
      }
    } else if (kind === 'remove' && op.path === path) {
      const value = op.value;
      if (typeof value === 'object' && value && 'id' in value) {
        const id = (value as any).id;
        const idx = list.findIndex((item) => item.id === id);
        if (idx >= 0) list.splice(idx, 1);
      } else if (typeof value === 'number') {
        list.splice(value, 1);
      }
    }
  }
  return list;
}

export class ClientListAdapter<T> implements ClientObject {
  readonly id: string;
  private readonly path: string;
  private list: T[] = [];
  private rev = 0;
  private listeners = new Set<(list: T[], rev: number) => void>();
  private readonly hydrate?: (item: unknown) => T;

  constructor(id: string, path = 'entries', hydrate?: (item: unknown) => T) {
    this.id = id;
    this.path = path;
    this.hydrate = hydrate;
  }

  onReplace(rev: number, value: unknown) {
    if (rev <= this.rev) return;
    const list = Array.isArray((value as any)?.[this.path]) ? (value as any)[this.path] : [];
    this.rev = rev;
    this.list = list.map((item: unknown) => this.makeItem(item));
    this.emit();
  }

  onPatch(rev: number, ops: unknown[]) {
    if (rev <= this.rev) return;
    const next = applyListOps(this.path, this.list, Array.isArray(ops) ? ops : []);
    this.rev = rev;
    this.list = next.map((item: unknown) => this.makeItem(item));
    this.emit();
  }

  getList() {
    return this.list.slice();
  }

  getRev() {
    return this.rev;
  }

  subscribe(listener: (list: T[], rev: number) => void) {
    this.listeners.add(listener);
    listener(this.getList(), this.rev);
    return () => this.listeners.delete(listener);
  }

  private makeItem(raw: unknown): T {
    return this.hydrate ? this.hydrate(raw) : (raw as T);
  }

  private emit() {
    const snapshot = this.getList();
    for (const listener of this.listeners) {
      listener(snapshot, this.rev);
    }
  }
}

export class ClientKeyedListAdapter<T extends WithId> implements ClientObject {
  readonly id: string;
  private readonly path: string;
  private list: T[] = [];
  private rev = 0;
  private listeners = new Set<(list: T[], rev: number) => void>();
  private readonly hydrate?: (item: unknown) => T;

  constructor(id: string, path = 'list', hydrate?: (item: unknown) => T) {
    this.id = id;
    this.path = path;
    this.hydrate = hydrate;
  }

  onReplace(rev: number, value: unknown) {
    if (rev <= this.rev) return;
    const list = Array.isArray((value as any)?.[this.path]) ? (value as any)[this.path] : [];
    this.rev = rev;
    this.list = list.map((item: unknown) => this.makeItem(item));
    this.emit();
  }

  onPatch(rev: number, ops: unknown[]) {
    if (rev <= this.rev) return;
    const next = applyKeyedListOps(this.path, this.list, Array.isArray(ops) ? ops : []);
    this.rev = rev;
    this.list = next.map((item: unknown) => this.makeItem(item));
    this.emit();
  }

  getList() {
    return this.list.slice();
  }

  getRev() {
    return this.rev;
  }

  subscribe(listener: (list: T[], rev: number) => void) {
    this.listeners.add(listener);
    listener(this.getList(), this.rev);
    return () => this.listeners.delete(listener);
  }

  private makeItem(raw: unknown): T {
    return this.hydrate ? this.hydrate(raw) : (raw as T);
  }

  private emit() {
    const snapshot = this.getList();
    for (const listener of this.listeners) {
      listener(snapshot, this.rev);
    }
  }
}

type ValueNetObjectOptions<T> = {
  id: string;
  initial?: T;
  host?: {
    ack?: HostAckPolicy;
    initContext?: string;
    onPeerConnect?: (object: HostValueObject<T>, deps: CommonDeps) => void;
  };
  client?: {
    requestOnStart?: boolean;
    requestContext?: string;
    transform?: (value: unknown) => T | null;
  };
};

export function defineValueNetObject<T>(options: ValueNetObjectOptions<T>) {
  const clientAdapter = new ClientValueAdapter<T>(options.id, options.client?.transform);
  const descriptor: NetObjectDescriptor = {
    id: options.id,
    host: {
      create: (deps) => new HostValueObject<T>(deps, options.id, options.initial, options.host?.initContext),
      ack: options.host?.ack ?? { incrementalMax: 1, fallbackStrategy: HostAckFallback.Snapshot },
      onPeerConnect: (object, deps) => {
        if (options.host?.onPeerConnect) {
          options.host.onPeerConnect(object as HostValueObject<T>, deps);
        } else {
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
      getObject: () => getHostObject<HostValueObject<T>>(options.id),
      set: (value: T, context?: string) => getHostObject<HostValueObject<T>>(options.id)?.set(value, context),
      merge: (partial: Partial<T>, context?: string) => getHostObject<HostValueObject<T>>(options.id)?.merge(partial, context)
    },
    client: clientAdapter
  };
}

type ListNetObjectOptions<T> = {
  id: string;
  path?: string;
  initial?: T[];
  max?: number;
  host?: {
    ack?: HostAckPolicy;
    initContext?: string;
    onPeerConnect?: (object: HostListObject<T>, deps: CommonDeps) => void;
  };
  client?: {
    requestOnStart?: boolean;
    requestContext?: string;
    hydrate?: (item: unknown) => T;
  };
};

export function defineListNetObject<T>(options: ListNetObjectOptions<T>) {
  const path = options.path ?? 'entries';
  const clientAdapter = new ClientListAdapter<T>(options.id, path, options.client?.hydrate);
  const descriptor: NetObjectDescriptor = {
    id: options.id,
    host: {
      create: (deps) => new HostListObject<T>(deps, options.id, {
        path,
        initial: options.initial,
        max: options.max,
        context: options.host?.initContext
      }),
      ack: options.host?.ack ?? { incrementalMax: 32, fallbackStrategy: HostAckFallback.Snapshot },
      onPeerConnect: (object, deps) => {
        if (options.host?.onPeerConnect) {
          options.host.onPeerConnect(object as HostListObject<T>, deps);
        } else {
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
      getObject: () => getHostObject<HostListObject<T>>(options.id),
      append: (item: T, context?: string) => getHostObject<HostListObject<T>>(options.id)?.append(item, context),
      replaceAll: (items: T[], context?: string) => getHostObject<HostListObject<T>>(options.id)?.replaceAll(items, context)
    },
    client: clientAdapter
  };
}

type KeyedListNetObjectOptions<T extends WithId> = {
  id: string;
  path?: string;
  initial?: T[];
  host?: {
    ack?: HostAckPolicy;
    initContext?: string;
    onPeerConnect?: (object: HostKeyedListObject<T>, deps: CommonDeps) => void;
  };
  client?: {
    requestOnStart?: boolean;
    requestContext?: string;
    hydrate?: (item: unknown) => T;
  };
};

export function defineKeyedListNetObject<T extends WithId>(options: KeyedListNetObjectOptions<T>) {
  const path = options.path ?? 'list';
  const clientAdapter = new ClientKeyedListAdapter<T>(options.id, path, options.client?.hydrate);
  const descriptor: NetObjectDescriptor = {
    id: options.id,
    host: {
      create: (deps) => new HostKeyedListObject<T>(deps, options.id, {
        path,
        initial: options.initial,
        context: options.host?.initContext
      }),
      ack: options.host?.ack ?? { incrementalMax: 32, fallbackStrategy: HostAckFallback.Snapshot },
      onPeerConnect: (object, deps) => {
        if (options.host?.onPeerConnect) {
          options.host.onPeerConnect(object as HostKeyedListObject<T>, deps);
        } else {
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
      getObject: () => getHostObject<HostKeyedListObject<T>>(options.id),
      upsertMany: (entries: T[], context?: string) => getHostObject<HostKeyedListObject<T>>(options.id)?.upsertMany(entries, context),
      removeById: (entryId: string, context?: string) => getHostObject<HostKeyedListObject<T>>(options.id)?.removeById(entryId, context)
    },
    client: clientAdapter
  };
}
