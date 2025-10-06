import type { AICommand } from './ai-router';
import { parseAICommand } from './ai-router';
import { runWithManagerLock } from './gateway/lock';
import { resolveGatewayConfig } from './gateway/config';
import { summariseAllowed, buildTwoPhaseCmdPrompt, buildTwoPhaseBodyPrompt } from './gateway/prompts';
import { ensureRuntimeReady, generateWithTimeout } from './gateway/llm-exec';
import { markFirstGenDone } from './gateway/state';
import type { AIGatewayParams } from './gateway/types';
// alias normalisation removed: require exact cmd matches

export async function requestAICommand(params: AIGatewayParams): Promise<AICommand> {
  const {
    manager,
    userInstruction,
    contextText,
    temperature = 0.5,
    maxTokens,
    fallbackChatText = '문제가 발생했습니다.',
    timeoutMs
  } = params;

  return runWithManagerLock(manager, async () => {
    const { allowedSet, allowedCmdsText, capabilitiesDoc } = summariseAllowed();
    // Inline user prompt formatting (replaces removed buildUserPrompt)
    const user = [
      userInstruction,
      contextText ? '' : undefined,
      contextText ? '맥락:' : undefined,
      contextText ?? undefined
    ]
      .filter(Boolean)
      .join('\n');

    const { maxTokens: maxTok, effectiveTimeout } = resolveGatewayConfig(manager, {
      maxTokens,
      timeoutMs,
      twoPhase: true
    });

    // Two-phase only: 1) choose cmd, 2) fill body, 3) score
    await ensureRuntimeReady(manager);
    const sysCmd = buildTwoPhaseCmdPrompt(allowedCmdsText, capabilitiesDoc);
    const attempts = Math.max(1, Math.min(3, (typeof (params as any)?.maxAttempts === 'number' ? (params as any).maxAttempts : 2)));
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let rawCmd = '';
      try {
        rawCmd = await generateWithTimeout(user, {
          systemPrompt: sysCmd,
          temperature: 0,
          maxTokens: 24,
          timeoutMs: Math.min(10_000, Math.max(2_000, (timeoutMs ?? effectiveTimeout) / 3))
        });
      } catch (err) {
        // timeout/abort or transient error → try next attempt
        continue;
      }
      const chosen = parseAICommand(rawCmd);
      if (!chosen || !allowedSet.has(chosen.cmd)) continue;

      const sysBody = buildTwoPhaseBodyPrompt(chosen.cmd);
      let rawBody = '';
      try {
        rawBody = await generateWithTimeout(user, {
          systemPrompt: sysBody,
          temperature,
          maxTokens: maxTok,
          timeoutMs: Math.min(14_000, Math.max(3_000, (timeoutMs ?? effectiveTimeout) / 2))
        });
      } catch (err) {
        // timeout/abort or transient error → try next attempt
        continue;
      }
      const out = parseAICommand(rawBody);
      if (!out || !allowedSet.has(out.cmd)) continue;

      markFirstGenDone(manager);
      return out;
    }

    // Hard fallback: safe chat with default text
    return { cmd: 'chat', body: fallbackChatText };
  });
}
