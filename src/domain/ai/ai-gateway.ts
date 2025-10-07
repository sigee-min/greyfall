import type { AICommand } from './ai-router';
import { runWithManagerLock } from './gateway/lock';
import { resolveGatewayConfig } from './gateway/config';
import { ensureRuntimeReady, generateMessagesWithTimeout, type ChatMessage } from './gateway/llm-exec';
import { runPipeline } from '../../llm/pipeline/runner';
import { InMemoryNodeRegistry } from '../../llm/pipeline/registry';
import type { Step, PipelineCtx, MessageExecutor } from '../../llm/pipeline/types';
import { summariseAllowed } from './gateway/prompts';
import { makeDefaultToolsHost } from '../../llm/tools';
import { getToolsProviders } from '../../llm/tools/providers';
import type { AIGatewayParams } from './gateway/types';
import type { ChatHistoryIn, ChatHistoryOut } from '../../llm/tools/impl/chat-history';

const DEBUG = Boolean((import.meta as any).env?.VITE_LLM_DEBUG);

// NOTE: Phase-based request flow removed.
// This gateway now builds a single messages array (system + user) and calls the LLM once.
// WebLLM branch can be added later with a TODO; current implementation targets Transformers.js pipeline.

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
    if (DEBUG) console.debug(`[gw] start manager=${manager} hasContext=${Boolean(contextText)} temp=${temperature} maxTokens=${maxTokens ?? 'auto'} timeout=${timeoutMs ?? 'auto'}`);
    const { maxTokens: maxTok, effectiveTimeout } = resolveGatewayConfig(manager, {
      maxTokens,
      timeoutMs,
      twoPhase: false
    });

    if (DEBUG) console.debug('[gw] ensureRuntimeReady.begin');
    await ensureRuntimeReady(manager);
    if (DEBUG) console.debug('[gw] ensureRuntimeReady.ok');

    // 1) Choose command
    const { allowedCmdsText, capabilitiesDoc } = summariseAllowed();
    const choose: Step = {
      id: 'choose-cmd',
      nodeId: 'cmd.choose',
      params: () => ({ allowedCmdsText, capabilitiesDoc }),
      next: null
    };

    const ctx: PipelineCtx = {
      user: userInstruction,
      manager,
      scratch: { overrides: { temperature, maxTokens: maxTok, timeoutMs: Math.min(60_000, Math.max(3_000, effectiveTimeout)) } },
      tools: makeDefaultToolsHost({ manager, providers: getToolsProviders() })
    };
    const exec: MessageExecutor = async (msgs, opts) => {
      if (DEBUG) console.debug(`[gw.exec] run messages=${msgs.length} temp=${opts.temperature} maxTokens=${opts.maxTokens} timeout=${opts.timeoutMs}`);
      const out = await generateMessagesWithTimeout(manager, msgs as ChatMessage[], opts);
      if (DEBUG) console.debug(`[gw.exec] done chars=${out.length}`);
      return out;
    };
    try {
      // run choose node
      if (DEBUG) console.debug('[gw] choose.begin');
      await runPipeline({ start: choose, ctx, registry: InMemoryNodeRegistry, exec });
      const cmd = String((ctx.scratch?.chosenCmd as any) || 'chat');
      if (DEBUG) console.debug(`[gw] choose.done cmd=${cmd}`);
      // 2) Build pipeline per command (for now, only chat.basic)
      let start: Step;
      if (cmd === 'chat') {
        start = {
          id: 'chat-step',
          nodeId: 'chat.basic',
          params: async (c) => {
            // chat.history 도구 호출
            let historyText = '';
            try {
              const res = await c.tools?.invoke<ChatHistoryIn, ChatHistoryOut>('chat.history', { limit: 10 });
              if (res && res.ok) {
                const items = res.data.items || [];
                historyText = items
                  .map((it: any) => `- ${it.author}(${it.role}): ${String(it.body || '').slice(0, 140)}`)
                  .join('\n');
              }
            } catch {}
            const parts: string[] = [];
            if (contextText && contextText.trim()) parts.push(`맥락:\n${contextText}`);
            if (historyText) parts.push(`최근 채팅(최대 10개):\n${historyText}`);
            if (DEBUG) console.debug(`[gw] chat.params hasHistory=${Boolean(historyText)} hasContext=${Boolean(contextText)}`);
            return {
              persona: '너는 TRPG 매니저이다. 한국어로만 말한다.',
              userSuffix: parts.length ? `\n${parts.join('\n\n')}` : ''
            };
          },
          next: null
        };
      } else {
        // TODO: pipeline for other commands (mission.start, etc.)
        start = {
          id: 'chat-fallback', nodeId: 'chat.basic', params: () => ({ persona: '간결한 한국어 응답만 합니다.', userSuffix: '' }), next: null
        };
      }
      if (DEBUG) console.debug(`[gw] pipeline.begin node=${start.nodeId}`);
      const done = await runPipeline({ start, ctx, registry: InMemoryNodeRegistry, exec });
      if (DEBUG) console.debug('[gw] pipeline.done');
      const text = String((done.scratch?.last as any)?.text || '') || fallbackChatText;
      if (DEBUG) console.debug(`[gw] out chars=${text.length}`);
      return { cmd, body: text };
    } catch (e) {
      if (DEBUG) console.debug('[gw] error', String((e as any)?.message || e));
      return { cmd: 'chat', body: fallbackChatText };
    }
  });
}
