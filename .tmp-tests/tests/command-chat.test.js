import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { commandRegistry } from '../src/domain/ai/command-registry.js';
import { ChatCommand } from '../src/domain/ai/commands/chat.js';
function registerNoCooldown() {
    const spec = { ...ChatCommand, policy: { ...(ChatCommand.policy ?? {}), cooldownMs: 0 } };
    commandRegistry.register(spec);
}
test('ChatCommand executes with string body', async () => {
    registerNoCooldown();
    let lastBody = '';
    const ok = await commandRegistry.execute({ id: 't1', cmd: 'chat', body: 'hello world' }, {
        manager: 'smart',
        publishLobbyMessage: (kind, payload) => {
            if (kind === 'chat') {
                // @ts-ignore
                lastBody = payload.entry.body;
            }
            return true;
        },
        participants: [{ id: 'host1', name: 'Host', tag: '#HOST', ready: true, role: 'host' }],
        localParticipantId: 'host1'
    });
    assert.equal(ok, true);
    assert.equal(lastBody, 'hello world');
});
test('ChatCommand coerce: object with {message} becomes string', async () => {
    registerNoCooldown();
    let lastBody = '';
    const ok = await commandRegistry.execute({ id: 't2', cmd: 'chat', body: { message: '안녕하세요' } }, {
        manager: 'smart',
        publishLobbyMessage: (kind, payload) => {
            if (kind === 'chat') {
                // @ts-ignore
                lastBody = payload.entry.body;
            }
            return true;
        },
        participants: [{ id: 'host1', name: 'Host', tag: '#HOST', ready: true, role: 'host' }],
        localParticipantId: 'host1'
    });
    assert.equal(ok, true);
    assert.equal(lastBody, '안녕하세요');
});
