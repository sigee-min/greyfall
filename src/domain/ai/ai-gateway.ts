import type { AICommand } from './ai-router';
import { parseAICommand } from './ai-router';
import { runWithManagerLock } from './gateway/lock';
import { resolveGatewayConfig } from './gateway/config';
import { summariseAllowed, buildSystemPrompt, buildUserPrompt, buildTwoPhaseCmdPrompt, buildTwoPhaseBodyPrompt, buildScorePrompts } from './gateway/prompts';
import { ensureRuntimeReady, generateWithTimeout, transientRetryGenerate } from './gateway/llm-exec';
import { isFirstGen, markFirstGenDone } from './gateway/state';
import type { AIGatewayParams } from './gateway/types';

export async function requestAICommand(params: AIGatewayParams): Promise<AICommand> {
  const {
    manager,
    userInstruction,
    contextText,
    temperature = 0.5,
    maxTokens,
    fallbackChatText = '채널에 합류했습니다.',
    timeoutMs
  } = params;

  return runWithManagerLock(manager, async () => {
    const { allowedSet, allowedCmdsText, capabilitiesDoc } = summariseAllowed();
    const sys = buildSystemPrompt(manager, allowedCmdsText, capabilitiesDoc);
    const user = buildUserPrompt(userInstruction, contextText);
    const { maxTokens: maxTok, effectiveTimeout, coldStartTimeout, useTwoPhase } = resolveGatewayConfig(manager, {
      maxTokens,
      timeoutMs,
      twoPhase: params.twoPhase
    });

    // Optional two-phase pipeline: 1) choose cmd, 2) fill body 3) score
    if (useTwoPhase) {
      try {
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
      } catch {
        // fall through to single-shot pipeline
      }
    }

    await ensureRuntimeReady(manager);

    const genTimeout = isFirstGen(manager) ? Math.max(effectiveTimeout, coldStartTimeout) : effectiveTimeout;
    let raw = '';
    try {
      raw = await transientRetryGenerate(user, {
        systemPrompt: sys,
        temperature,
        maxTokens: maxTok,
        timeoutMs: genTimeout
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[ai-gateway] LLM request failed; using fallback', { manager, error: message });
    }

    const parsed = parseAICommand(raw);
    if (parsed) {
      markFirstGenDone(manager);
      if (!allowedSet.has(parsed.cmd)) {
        try {
          const fixUser = [
            '이전 출력의 의도를 유지하되, 허용 명령(cmd) 중 하나로 선택해 JSON 한 줄로만 다시 출력하세요.',
            `허용 명령(cmd): ${allowedCmdsText}`,
            '이전 출력:',
            JSON.stringify(parsed)
          ].join('\n');
          const fixed = await transientRetryGenerate(fixUser, {
            systemPrompt: sys,
            temperature: 0,
            maxTokens: 64,
            timeoutMs: Math.min(8000, effectiveTimeout)
          });
          const reparsed = parseAICommand(fixed);
          if (reparsed && allowedSet.has(reparsed.cmd)) return reparsed;
        } catch {}
        const text = typeof parsed.body === 'string' && parsed.body.trim() ? parsed.body.trim() : fallbackChatText;
        return { cmd: 'chat', body: text };
      }
      return parsed;
    }

    let bodyText = fallbackChatText;
    if (raw) {
      markFirstGenDone(manager);
      const preview = typeof raw === 'string' ? raw.slice(0, 160) : String(raw);
      console.warn('[ai-gateway] Unparseable LLM output; falling back to chat', { preview });
      const trimmed = String(raw).trim();
      if (trimmed) bodyText = trimmed.slice(0, 400);
    } else {
      console.warn('[ai-gateway] Empty LLM output; falling back to chat');
    }
    return { cmd: 'chat', body: bodyText };
  });
}
