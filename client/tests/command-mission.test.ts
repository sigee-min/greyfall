import assert from 'node:assert/strict';
import { test } from './test-harness.js';
import { commandRegistry } from '../src/domain/ai/command-registry.js';
import { MissionStartCommand } from '../src/domain/ai/commands/mission-start.js';

function baseCtx(flags?: { llmReady?: boolean; everyoneReady?: boolean }) {
  return {
    manager: 'smart' as const,
    publishLobbyMessage: () => true,
    participants: [{ id: 'h', name: 'Host', tag: '#HOST', ready: true, role: 'host' as const }],
    localParticipantId: 'h',
    flags
  };
}

test('MissionStart: denied without preconditions', async () => {
  commandRegistry.register(MissionStartCommand);
  const ok = await commandRegistry.execute({ id: 'm1', cmd: 'mission.start', body: '' }, baseCtx({ llmReady: false, everyoneReady: true }));
  assert.equal(ok, false);
});

test('MissionStart: allowed when llmReady && everyoneReady', async () => {
  commandRegistry.register(MissionStartCommand);
  const ok = await commandRegistry.execute({ id: 'm2', cmd: 'mission.start', body: '' }, baseCtx({ llmReady: true, everyoneReady: true }));
  assert.equal(ok, true);
});

