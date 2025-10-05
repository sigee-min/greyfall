import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { ChatHostStore, CHAT_OBJECT_ID } from '../src/domain/net-objects/chat.js';

test('ChatHostStore: append publishes object:patch with insert op', () => {
  const sent: any[] = [];
  const publish = (kind: any, body: any) => {
    sent.push({ kind, body });
    return true;
  };
  const store = new ChatHostStore(publish, 10);
  store.append({
    id: 'm1',
    authorId: 'guide:host',
    authorName: '강림',
    authorTag: '#GUIDE',
    authorRole: 'host',
    body: '안녕하세요.',
    at: Date.now()
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'object:patch');
  assert.equal(sent[0].body.id, CHAT_OBJECT_ID);
  assert.equal(sent[0].body.rev, 1);
  const op = sent[0].body.ops[0];
  assert.equal(op.op, 'insert');
  assert.equal(op.path, 'entries');
  assert.equal(op.value.id, 'm1');
});

test('ChatHostStore: broadcastSnapshot publishes replace with entries', () => {
  const sent: any[] = [];
  const publish = (kind: any, body: any) => {
    sent.push({ kind, body });
    return true;
  };
  const store = new ChatHostStore(publish, 10);
  // when empty, no snapshot
  const skip = store.broadcastSnapshot();
  assert.equal(skip, false);
  assert.equal(sent.length, 0);

  // append and snapshot
  store.append({
    id: 'm2',
    authorId: 'guide:host',
    authorName: '강림',
    authorTag: '#GUIDE',
    authorRole: 'host',
    body: '시작합니다.',
    at: Date.now()
  });
  sent.length = 0;
  const ok = store.broadcastSnapshot();
  assert.equal(ok, true);
  assert.equal(sent[0].kind, 'object:replace');
  assert.equal(sent[0].body.id, CHAT_OBJECT_ID);
  assert.ok(Array.isArray(sent[0].body.value.entries));
  assert.equal(sent[0].body.value.entries.length, 1);
});
