import type { AICommand } from './ai-router';
import { parseAICommand } from './ai-router';
import { runWithManagerLock } from './gateway/lock';
import { resolveGatewayConfig } from './gateway/config';
import { summariseAllowed, buildTwoPhaseCmdPrompt, buildTwoPhaseBodyPrompt, buildScorePrompts } from './gateway/prompts';
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
    const { allowedSet, allowedCmdsText } = summariseAllowed();
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
    const sysCmd = buildTwoPhaseCmdPrompt(allowedCmdsText);
    let best: AICommand | null = null;
    let bestScore = -1;
    const attempts = Math.max(1, Math.min(5, (typeof (params as any)?.maxAttempts === 'number' ? (params as any).maxAttempts : 3)));
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const rawCmd = await generateWithTimeout(user, {
        systemPrompt: sysCmd,
        temperature: 0,
        maxTokens: 24,
        timeoutMs: Math.min(10_000, Math.max(2_000, (timeoutMs ?? effectiveTimeout) / 3))
      });
      const chosen = parseAICommand(rawCmd);
      if (!chosen || !allowedSet.has(chosen.cmd)) continue;

      const sysBody = buildTwoPhaseBodyPrompt(chosen.cmd);
      const rawBody = await generateWithTimeout(user, {
        systemPrompt: sysBody,
        temperature,
        maxTokens: maxTok,
        timeoutMs: Math.min(14_000, Math.max(3_000, (timeoutMs ?? effectiveTimeout) / 2))
      });
      const out = parseAICommand(rawBody);
      if (!out || !allowedSet.has(out.cmd)) continue;

      const { sys: sysScore, user: userScore } = buildScorePrompts(allowedCmdsText, user, JSON.stringify(out));
      const scoredRaw = await generateWithTimeout(userScore, {
        systemPrompt: sysScore,
        temperature: 0,
        maxTokens: 24,
        timeoutMs: Math.min(8_000, Math.max(2_000, (timeoutMs ?? effectiveTimeout) / 3))
      });
      const sr = ((): { score: number } | null => { try { return JSON.parse(scoredRaw) as any; } catch { return null; } })();
      const sc = Math.max(0, Math.min(10, Math.round(Number(sr?.score ?? 0))));
      if (sc > bestScore) { bestScore = sc; best = out; }
      if (sc >= (typeof (params as any)?.minScore === 'number' ? (params as any).minScore : 6)) {
        markFirstGenDone(manager);
        return out;
      }
    }
    if (best) {
      markFirstGenDone(manager);
      return best;
    }

    // Hard fallback: safe chat with default text
    return { cmd: 'chat', body: fallbackChatText };
  });
}
