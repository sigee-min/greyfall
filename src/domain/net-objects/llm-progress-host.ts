import type { HostObject, CommonDeps } from './types';
import { HostValueObject } from './base/value-object';
import type { LobbyMessageBodies } from '../../protocol';
import { registerNetObject, HostAckFallback } from './registry.js';

export const LLM_PROGRESS_OBJECT_ID = 'llm:progress:obj';

type ProgressState = {
  ready: boolean;
  progress: number | null;
  status: string | null;
  error: string | null;
  updatedAt: number;
};

export class HostLlmProgressObject extends HostValueObject<ProgressState> implements HostObject {
  constructor(deps: CommonDeps) {
    super(deps, LLM_PROGRESS_OBJECT_ID, {
      ready: false,
      progress: null,
      status: null,
      error: null,
      updatedAt: Date.now()
    }, 'llm:progress:init');
  }

  update(payload: LobbyMessageBodies['llm:progress']) {
    const patch: Partial<ProgressState> = { updatedAt: Date.now() };
    if ('ready' in payload) patch.ready = !!payload.ready;
    if ('progress' in payload) patch.progress = payload.progress ?? null;
    if ('status' in payload) patch.status = (payload.status ?? null) as any;
    if ('error' in payload) patch.error = (payload.error ?? null) as any;
    this.merge(patch, 'llm:progress:update');
  }

  onRequest(sinceRev?: number) {
    return super.onRequest(sinceRev);
  }

  getSnapshot() {
    return super.getSnapshot();
  }

  getLogsSince(sinceRev: number) {
    return super.getLogsSince(sinceRev);
  }
}

registerNetObject({
  id: LLM_PROGRESS_OBJECT_ID,
  host: {
    create: (deps) => new HostLlmProgressObject(deps),
    ack: {
      incrementalMax: 10,
      fallbackStrategy: HostAckFallback.Snapshot
    },
    onPeerConnect: (object) => {
      object.onRequest(undefined);
    }
  },
  client: {
    requestOnStart: true,
    requestContext: 'request llm progress'
  }
});
