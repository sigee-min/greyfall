import { HostRouter } from '../src/domain/net-objects/host-router.js';
import { HostParticipantsObject } from '../src/domain/net-objects/participants-host.js';
import { HostChatObject } from '../src/domain/net-objects/chat-host.js';
import { SlidingWindowLimiter } from '../src/domain/net-objects/rate-limit.js';
function makeLobbyStore() {
    const list = [];
    return {
        participantsRef: { current: list },
        localParticipantIdRef: { current: null },
        snapshotWire: () => list.slice(),
        replaceFromWire: (l) => { list.length = 0; list.push(...l); },
        upsertFromWire: (p) => { const i = list.findIndex((e) => e.id === p.id); if (i >= 0)
            list[i] = p;
        else
            list.push(p); },
        remove: (id) => { const i = list.findIndex((e) => e.id === id); if (i >= 0)
            list.splice(i, 1); }
    };
}
import { test } from './test-harness.js';
const sent = [];
const send = ((k, b) => { sent.push({ k, b }); return true; });
const publishToBus = (_) => { };
test('chat append rate limit caps messages', async () => {
    sent.length = 0;
    const store = makeLobbyStore();
    store.replaceFromWire([{ id: 'g1', name: 'G1', tag: '#G1', ready: false, role: 'guest' }]);
    const participants = new HostParticipantsObject({ publish: send, lobbyStore: store });
    const chat = new HostChatObject({ publish: send, lobbyStore: store });
    const limiter = new SlidingWindowLimiter(2, 10000); // 2 per window
    const router = new HostRouter({ send, lobbyStore: store, publishToBus, participants, chat, limiter });
    for (let i = 0; i < 5; i++) {
        router.handle({ scope: 'lobby', version: 1, kind: 'chat:append:request', body: { authorId: 'g1', body: 'hi' + i } });
    }
    const patches = sent.filter((m) => m.k === 'object:patch' && m.b.id === 'chatlog');
    if (patches.length !== 2)
        throw new Error('rate limit did not cap chat appends');
});
