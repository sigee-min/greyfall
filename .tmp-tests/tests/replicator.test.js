import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { HostReplicator } from '../src/domain/net-objects/replicator.js';
test('HostReplicator: set publishes object:replace with rev++', () => {
    const sent = [];
    const publish = (kind, body) => {
        sent.push({ kind, body });
        return true;
    };
    const r = new HostReplicator(publish);
    r.set('obj1', { a: 1 });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].kind, 'object:replace');
    assert.equal(sent[0].body.id, 'obj1');
    assert.equal(sent[0].body.rev, 1);
    assert.deepEqual(sent[0].body.value, { a: 1 });
});
test('HostReplicator: apply merge op increments rev and publishes patch', () => {
    const sent = [];
    const publish = (kind, body) => {
        sent.push({ kind, body });
        return true;
    };
    const r = new HostReplicator(publish);
    r.set('obj', { a: 1 });
    r.apply('obj', [{ op: 'merge', value: { b: 2 } }]);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].kind, 'object:patch');
    assert.equal(sent[1].body.id, 'obj');
    assert.equal(sent[1].body.rev, 2);
    assert.deepEqual(sent[1].body.ops, [{ op: 'merge', value: { b: 2 } }]);
});
test('HostReplicator: onRequest publishes latest replace', () => {
    const sent = [];
    const publish = (kind, body) => {
        sent.push({ kind, body });
        return true;
    };
    const r = new HostReplicator(publish);
    r.set('obj', { a: 1 });
    sent.length = 0;
    const ok = r.onRequest('obj');
    assert.equal(ok, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].kind, 'object:replace');
    assert.equal(sent[0].body.rev, 1);
    assert.deepEqual(sent[0].body.value, { a: 1 });
});
