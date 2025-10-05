import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { commandRegistry } from '../src/domain/ai/command-registry.js';
import { ChatCommand } from '../src/domain/ai/commands/chat.js';
test('AI command idempotency: duplicate id ignored', async () => {
    // register (no cooldown)
    const spec = { ...ChatCommand, policy: { cooldownMs: 0, role: 'host' } };
    commandRegistry.register(spec);
    const ctx = {
        manager: 'smart',
        publishLobbyMessage: () => true,
        participants: [{ id: 'h', name: 'Host', tag: '#HOST', ready: true, role: 'host' }],
        localParticipantId: 'h'
    };
    const id = 'dup-1';
    const ok1 = await commandRegistry.execute({ id, cmd: 'chat', body: 'hello' }, ctx);
    const ok2 = await commandRegistry.execute({ id, cmd: 'chat', body: 'hello again' }, ctx);
    assert.equal(ok1, true);
    assert.equal(ok2, false);
});
