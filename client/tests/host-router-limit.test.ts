import { HostRouter } from '../src/domain/net-objects/host-router.js';
import { SlidingWindowLimiter } from '../src/domain/net-objects/rate-limit.js';
import { getNetObjectDescriptors } from '../src/domain/net-objects/registry.js';
import type { HostObject } from '../src/domain/net-objects/types.js';

function makeLobbyStore() {
  const list: any[] = [];
  return {
    participantsRef: { current: list },
    localParticipantIdRef: { current: null },
    snapshotWire: () => list.slice(),
    replaceFromWire: (l: any[]) => { list.length = 0; list.push(...l); },
    upsertFromWire: (p: any) => { const i = list.findIndex((e) => e.id === p.id); if (i>=0) list[i]=p; else list.push(p); },
    remove: (id: string) => { const i = list.findIndex((e) => e.id===id); if (i>=0) list.splice(i,1); }
  } as any;
}

import { test } from './test-harness.js';

const sent: any[] = [];
const send = ((k: any, b: any, c?: string) => { sent.push({ k, b, c }); return true; }) as any;
const publishToBus = (_: any) => {};

test('chat append rate limit caps messages', async () => {
    sent.length = 0;
    const store = makeLobbyStore();
    (store as any).replaceFromWire([{ id: 'g1', name: 'G1', tag: '#G1', ready: false, role: 'guest' }]);
    const descriptors = getNetObjectDescriptors();
    const objects = new Map<string, HostObject>();
    const deps = { publish: send, lobbyStore: store } as any;
    for (const descriptor of descriptors) {
      const object = descriptor.host.create(deps, {
        get: (id) => objects.get(id) ?? null
      });
      objects.set(descriptor.id, object);
    }
    const limiter = new SlidingWindowLimiter(2, 10_000); // 2 per window
    const router = new HostRouter({
      send,
      lobbyStore: store,
      publishToBus,
      descriptors,
      objects,
      commonDeps: deps,
      limiter
    });
    for (let i = 0; i < 5; i++) {
      router.handle({ scope: 'lobby', version: 1, kind: 'chat:append:request', body: { authorId: 'g1', body: 'hi'+i } });
    }
    const patches = sent.filter((m) => m.k === 'object:patch' && (m.b as any).id === 'chatlog');
    if (patches.length !== 2) throw new Error('rate limit did not cap chat appends');
});
