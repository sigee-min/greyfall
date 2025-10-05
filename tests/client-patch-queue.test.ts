import { ClientNetObjectStore } from '../src/domain/net-objects/client-store.js';
import { test } from './test-harness.js';

test('client queues future patch and drains after replace', async () => {
    const store = new ClientNetObjectStore();
    // no base -> patch ignored (false)
    const p0 = store.applyPatch('obj', 2, [{ op: 'set', value: { a: 2 } } as any]);
    if (p0 !== false) throw new Error('expected false without base');
    // apply replace rev1
    const r1 = store.applyReplace('obj', 1, { a: 1 });
    if (!r1) throw new Error('replace rev1 failed');
    // now future patch should queue
    const p1 = store.applyPatch('obj', 3, [{ op: 'merge', path: undefined as any, value: { b: 3 } } as any]);
    if (!p1) throw new Error('future patch should be queued as true');
    // apply rev2 -> should drain queued rev3
    const r2 = store.applyPatch('obj', 2, [{ op: 'merge', value: { a: 2 } } as any]);
    if (!r2) throw new Error('apply rev2 failed');
});
