import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { parseAICommand } from '../src/domain/ai/ai-router.js';
test('parseAICommand: valid json returns command', () => {
    const c = parseAICommand('{"cmd":"chat","body":"hello"}');
    assert.ok(c);
    assert.equal(c?.cmd, 'chat');
    assert.equal(c?.body, 'hello');
});
test('parseAICommand: invalid json returns null', () => {
    const c = parseAICommand('not-json');
    assert.equal(c, null);
});
