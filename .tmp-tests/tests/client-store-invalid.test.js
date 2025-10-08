import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { ClientNetObjectStore } from '../src/domain/net-objects/client-store.js';
test('ClientNetObjectStore: invalid ops rejected', () => {
    const store = new ClientNetObjectStore();
    store.applyReplace('obj', 1, { entries: [] });
    // invalid op (missing op field)
    const ok = store.applyPatch('obj', 2, [{ path: 'entries', value: { id: 'x' } }]);
    assert.equal(ok, false);
    const s = store.get('obj');
    assert.equal(s.rev, 1);
});
