import { HostNetController } from '../src/domain/net-objects/host-controller.js';
import { test } from './test-harness.js';
function makeLobbyStore() {
    const list = [];
    return {
        participantsRef: { current: list },
        localParticipantIdRef: { current: null },
        snapshotWire: () => list.slice(),
        replaceFromWire: (l) => { list.length = 0; list.push(...l); },
        upsertFromWire: (p) => {
            const idx = list.findIndex((e) => e.id === p.id);
            if (idx >= 0)
                list[idx] = p;
            else
                list.push(p);
        },
        remove: (id) => {
            const idx = list.findIndex((e) => e.id === id);
            if (idx >= 0)
                list.splice(idx, 1);
        }
    };
}
let published = [];
test('object ack schedules resend on timeout', async () => {
    published = [];
    const store = makeLobbyStore();
    const publish = ((kind, body) => { published.push({ kind, body }); return true; });
    const ctrl = new HostNetController({ publish, lobbyStore: store, busPublish: (_) => { } });
    // seed participants
    store.replaceFromWire([{ id: 'host', name: 'H', tag: '#H', ready: false, role: 'host' }]);
    // trigger broadcast -> schedules ack wait
    ctrl.broadcastParticipants('test');
    // wait > 1s for first resend
    await new Promise((r) => setTimeout(r, 1200));
    const replaces = published.filter((m) => m.kind === 'object:replace' && m.body.id === 'participants');
    if (replaces.length < 2)
        throw new Error('expected resend replace after timeout');
});
