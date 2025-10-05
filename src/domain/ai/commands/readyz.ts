import { z } from 'zod';
import type { CommandSpec } from '../command-registry';
import { probeChatApiReady, probeChatApiActive } from '../../../llm/webllm-engine';

export const ReadyzCommand: CommandSpec<string> = {
  cmd: 'llm.readyz',
  schema: z.string(),
  doc: 'llm.readyz — LLM 준비 상태 헬스체크(준비 전에는 에러 대신 대기 로그만).',
  policy: { role: 'host', cooldownMs: 1500 },
  handler: async (_text, ctx) => {
    // Non-blocking probe; does not trigger model download
    const probe = await probeChatApiReady(600);
    if (probe.initialised && probe.chatApiReady) {
      const active = await probeChatApiActive(1000);
      if (active) return true; // approved; caller may proceed to next command
    }
    // Do not surface errors; log and wait
    console.debug('[llm.readyz] waiting', {
      initialised: probe.initialised,
      chatApiReady: probe.chatApiReady
    });
    return false;
  }
};
