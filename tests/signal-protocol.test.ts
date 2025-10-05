import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { createSignalServerMessage, parseSignalServerMessage } from '../signal/src/protocol/schema.js';

test('Signal protocol: server ack encode/decode', () => {
  const msg = createSignalServerMessage('ack', { role: 'host', sessionId: 'XYZ' });
  const parsed = parseSignalServerMessage(msg);
  assert.ok(parsed);
  assert.equal(parsed?.kind, 'ack');
  assert.equal(parsed?.body.role, 'host');
  assert.equal(parsed?.body.sessionId, 'XYZ');
});
