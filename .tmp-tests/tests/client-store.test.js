import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { ClientNetObjectStore } from '../src/domain/net-objects/client-store.js';
test('ClientNetObjectStore: queue future patch and apply in order', () => {
    const store = new ClientNetObjectStore();
    // No base yet → replace rev1
    const okReplace = store.applyReplace('obj', 1, { entries: [{ id: 'a', v: 1 }] });
    assert.equal(okReplace, true);
    // Future patch rev3 arrives first → queue
    const queued = store.applyPatch('obj', 3, [{ op: 'merge', path: 'entries', value: { id: 'b', v: 1 } }]);
    assert.equal(queued, true);
    // Now rev2 arrives → apply and then flush rev3
    const ok2 = store.applyPatch('obj', 2, [{ op: 'merge', path: 'entries', value: { id: 'a', v: 2 } }]);
    assert.equal(ok2, true);
    const final = store.get('obj');
    assert.equal(final.rev, 3);
    const list = final.value.entries;
    const a = list.find((e) => e.id === 'a');
    const b = list.find((e) => e.id === 'b');
    assert.equal(a.v, 2);
    assert.equal(b.v, 1);
});
test('ClientNetObjectStore: insert and remove ops on arrays', () => {
    const store = new ClientNetObjectStore();
    store.applyReplace('arr', 1, { entries: [] });
    // insert single
    store.applyPatch('arr', 2, [{ op: 'insert', path: 'entries', value: { id: 'x', val: 1 } }]);
    // insert many
    store.applyPatch('arr', 3, [{ op: 'insert', path: 'entries', value: [{ id: 'y', val: 2 }, { id: 'z', val: 3 }] }]);
    // remove by id
    store.applyPatch('arr', 4, [{ op: 'remove', path: 'entries', value: { id: 'y' } }]);
    const s = store.get('arr');
    const list = s.value.entries;
    assert.equal(s.rev, 4);
    assert.equal(list.length, 2);
    assert.equal(list[0].id, 'x');
    assert.equal(list[1].id, 'z');
});
