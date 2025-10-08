import { useSyncExternalStore } from 'react';
import { HostReplicator } from './replicator.js';
import type { LobbyMessage } from '../../protocol/index.js';
import type { LobbyStore } from '../session/session-store';
import type { HostRouter } from './host-router.js';
import { registerNetObject, HostAckFallback, attachClientObject, attachHostObject } from './registry.js';
import type { CommonDeps, ClientObject, HostObject } from './types';

type EqualityFn<T> = (a: T, b: T) => boolean;

export type SyncModelCommandConfig<T, Payload = unknown> = {
  kind: LobbyMessage['kind'];
  parse: (body: unknown) => Payload | null;
  authorize?: (input: { payload: Payload; peerId?: string; senderId?: string | null; lobbyStore: LobbyStore }) => boolean;
  handle: (input: {
    payload: Payload;
    host: SyncModelHostApi<T>;
    context: SyncModelCommandRuntimeContext & { message: LobbyMessage };
  }) => void;
};

type SyncModelConfig<T> = {
  id: string;
  initial: () => T;
  serialize?: (data: T) => unknown;
  deserialize?: (value: unknown) => T | null;
  equality?: EqualityFn<T>;
  requestOnStart?: boolean;
  incrementalMax?: number;
  ackFallback?: HostAckFallback;
  commands?: SyncModelCommandConfig<T, any>[];
};

export type SyncModel<T> = SyncModelConfig<T>;

type HostQueueItem<T> = (host: HostSyncModelObject<T>) => void;

type HostRef<T> = {
  current: HostSyncModelObject<T> | null;
  queue: HostQueueItem<T>[];
  listeners: Set<(api: SyncModelHostApi<T>) => void>;
};

type RouterCommandApi = Pick<HostRouter, 'updateParticipantReady'>;

type SyncModelCommandRuntimeContext = {
  peerId?: string;
  senderId?: string | null;
  lobbyStore: LobbyStore;
  router: RouterCommandApi;
};

type ClientStore<T> = {
  value: T;
  listeners: Set<() => void>;
  equality: EqualityFn<T>;
};

type SyncModelHostApi<T> = {
  set: (value: T, context?: string) => boolean;
  update: (updater: (current: T) => T, context?: string) => boolean;
  get: () => T;
  requestSnapshot: (sinceRevision?: number) => boolean;
  onReady: (listener: (api: SyncModelHostApi<T>) => void) => () => void;
};

export type RegisteredSyncModel<T> = {
  id: string;
  initial: () => T;
  host: SyncModelHostApi<T>;
  use: <S = T>(selector?: (data: T) => S) => S;
};

const DEFAULT_EQUALITY = <T,>(a: T, b: T) => Object.is(a, b);

const clientStores = new Map<string, ClientStore<any>>();
const syncCommandHandlers = new Map<string, (context: SyncModelCommandRuntimeContext & { message: LobbyMessage }) => boolean>();
const hostRefs = new Map<string, HostRef<any>>();

export function defineSyncModel<T>(config: SyncModelConfig<T>): SyncModel<T> {
  return config;
}

export function registerSyncModel<T>(model: SyncModel<T>): RegisteredSyncModel<T> {
  const equality = model.equality ?? DEFAULT_EQUALITY;
  ensureClientStore(model.id, model.initial(), equality);
  const hostRef = ensureHostRef<T>(model.id);

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
      create: () => new ClientSyncModelObject(model),
      requestOnStart: model.requestOnStart ?? true,
      requestContext: `request ${model.id}`
    }
  });

  const hostApi: SyncModelHostApi<T> = {
    set: (value, context = 'sync:set') => enqueueHost(hostRef, (host) => host.setValue(value, context)),
    update: (updater, context = 'sync:update') =>
      enqueueHost(hostRef, (host) => host.setValue(updater(host.getValue()), context)),
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

  const use = <S = T>(selector?: (data: T) => S): S => {
    const sel = selector ?? ((data: T) => data as unknown as S);
    const store = getClientStore<T>(model.id);
    return useSyncExternalStore(
      (listener) => {
        store.listeners.add(listener);
        return () => store.listeners.delete(listener);
      },
      () => sel(store.value),
      () => sel(store.value)
    );
  };

  const registration: RegisteredSyncModel<T> = {
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

function ensureClientStore<T>(id: string, initial: T, equality: EqualityFn<T>): ClientStore<T> {
  if (clientStores.has(id)) {
    return clientStores.get(id) as ClientStore<T>;
  }
  const store: ClientStore<T> = {
    value: initial,
    listeners: new Set(),
    equality
  };
  clientStores.set(id, store);
  return store;
}

function getClientStore<T>(id: string): ClientStore<T> {
  const store = clientStores.get(id);
  if (!store) {
    throw new Error(`SyncModel client store missing for id=${id}`);
  }
  return store;
}

function ensureHostRef<T>(id: string): HostRef<T> {
  if (hostRefs.has(id)) {
    return hostRefs.get(id) as HostRef<T>;
  }
  const ref: HostRef<T> = {
    current: null,
    queue: [],
    listeners: new Set()
  };
  hostRefs.set(id, ref);
  return ref;
}

function enqueueHost<T>(ref: HostRef<T>, op: HostQueueItem<T>): boolean {
  const host = ref.current;
  if (host) {
    op(host);
    return true;
  }
  ref.queue.push(op);
  return true;
}

class HostSyncModelObject<T> implements HostObject {
  readonly id: string;
  private readonly replicator: HostReplicator;
  private current: T;
  constructor(private readonly model: SyncModel<T>, private readonly deps: CommonDeps, private readonly ref: HostRef<T>) {
    this.id = model.id;
    this.replicator = new HostReplicator((kind, body, context) => deps.publish(kind as any, body as any, context));
    this.current = model.initial();
    this.persist('sync:init');
    this.ref.current = this;
    const queue = [...this.ref.queue];
    this.ref.queue.length = 0;
    for (const op of queue) op(this);
    for (const listener of this.ref.listeners) listener(createHostApi(this, this.ref));
    attachHostObject(this);
  }

  setValue(value: T, context: string) {
    if (this.model.equality && this.model.equality(this.current, value)) return;
    this.current = value;
    this.persist(context);
  }

  getValue() {
    return this.current;
  }

  onRequest(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, 'sync:request');
  }

  requestSnapshot(sinceRev?: number) {
    return this.replicator.onRequest(this.id, sinceRev, 'sync:manual-request');
  }

  getSnapshot() {
    return this.replicator.get(this.id);
  }

  getLogsSince(sinceRev: number) {
    return this.replicator.getLogsSince(this.id, sinceRev);
  }

  private persist(context: string) {
    const serialized = this.model.serialize ? this.model.serialize(this.current) : this.current;
    this.replicator.set(this.id, serialized, context);
    updateClientStore(this.id, this.current, this.model.equality ?? DEFAULT_EQUALITY);
  }
}

class ClientSyncModelObject<T> implements ClientObject {
  readonly id: string;
  constructor(private readonly model: SyncModel<T>) {
    this.id = model.id;
    attachClientObject(this);
  }

  onReplace(_rev: number, value: unknown) {
    const parsed = this.parse(value);
    if (parsed == null) return;
    updateClientStore(this.id, parsed, this.model.equality ?? DEFAULT_EQUALITY);
  }

  onPatch(): void {
    // use replace semantics for now
  }

  private parse(value: unknown): T | null {
    if (this.model.deserialize) {
      return this.model.deserialize(value);
    }
    return value as T;
  }
}

function createHostApi<T>(host: HostSyncModelObject<T>, ref: HostRef<T>): SyncModelHostApi<T> {
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

function registerSyncModelCommand<T>(modelId: string, command: SyncModelCommandConfig<T, any>, host: SyncModelHostApi<T>) {
  const kind = command.kind;
  if (syncCommandHandlers.has(kind)) {
    console.warn(`[sync-model] duplicate command registration for ${kind}`);
  }
  syncCommandHandlers.set(kind, (runtime) => {
    const payload = command.parse(runtime.message.body);
    if (payload == null) return false;
    if (command.authorize && !command.authorize({ payload, peerId: runtime.peerId, senderId: runtime.senderId, lobbyStore: runtime.lobbyStore })) {
      console.warn(`[sync-model] command ${kind} unauthorized`, { sender: runtime.senderId });
      return true;
    }
    command.handle({ payload, host, context: runtime });
    return true;
  });
}

export function dispatchSyncModelCommand(message: LobbyMessage, runtime: SyncModelCommandRuntimeContext): boolean {
  const handler = syncCommandHandlers.get(message.kind);
  if (!handler) return false;
  return handler({ ...runtime, message });
}

function updateClientStore<T>(id: string, value: T, equality: EqualityFn<T>) {
  const store = clientStores.get(id);
  if (!store) return;
  if (equality(store.value, value)) return;
  store.value = value;
  for (const listener of store.listeners) listener();
}

export function useSyncModel<T, S = T>(
  registration: RegisteredSyncModel<T>,
  selector?: (data: T) => S
): S {
  return registration.use(selector);
}

export type { SyncModelHostApi };
