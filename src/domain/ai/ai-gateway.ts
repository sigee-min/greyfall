import type { AICommand } from './ai-router';
import { runWithManagerLock } from './gateway/lock';
import { resolveGatewayConfig } from './gateway/config';
import { ensureRuntimeReady, generateMessagesWithTimeout } from './gateway/llm-exec';
import { runPipeline } from '../../llm/pipeline/runner';
import { InMemoryNodeRegistry } from '../../llm/pipeline/registry';
import type { Step, PipelineCtx, MessageExecutor } from '../../llm/pipeline/types';
import { makeDefaultToolsHost } from '../../llm/tools';
import { getToolsProviders } from '../../llm/tools/providers';
import type { AIGatewayParams } from './gateway/types';
import type { ChatHistoryIn, ChatHistoryOut } from '../../llm/tools/impl/chat-history';

const DEBUG = Boolean(import.meta.env?.VITE_LLM_DEBUG);

function getLastOutputText(scratch: PipelineCtx['scratch']): string | null {
  const last = scratch.last;
  if (!last || typeof last !== 'object') return null;
  if (!('text' in last)) return null;
  const text = (last as { text?: unknown }).text;
  return typeof text === 'string' && text.trim() ? text : null;
}

function formatHistory(items: ChatHistoryOut['items']): string {
  return items
    .map((item) => `- ${item.author}(${item.role}): ${item.body.slice(0, 140)}`)
    .join('\n');
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// NOTE: Phase-based request flow removed.
// This gateway now builds a single messages array (system + user) and calls the LLM once.
// WebLLM branch can be added later with a TODO; current implementation targets Transformers.js pipeline.

export async function requestAICommand(params: AIGatewayParams): Promise<AICommand> {
  const {
    manager,
    requestType,
    userInstruction,
    persona,
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

    const ctx: PipelineCtx = {
      user: userInstruction,
      manager,
      scratch: { overrides: { temperature, maxTokens: maxTok, timeoutMs: Math.min(60_000, Math.max(3_000, effectiveTimeout)) } },
      tools: makeDefaultToolsHost({ manager, providers: getToolsProviders() })
    };
    const exec: MessageExecutor = async (msgs, opts) => {
      if (DEBUG) console.debug(`[gw.exec] run messages=${msgs.length} temp=${opts.temperature} maxTokens=${opts.maxTokens} timeout=${opts.timeoutMs}`);
      const out = await generateMessagesWithTimeout(manager, msgs, opts);
      if (DEBUG) console.debug(`[gw.exec] done chars=${out.length}`);
      return out;
    };
    try {
      const defaultPersona = persona ?? '너는 Greyfall TRPG 매니저이다. 한국어로만 말한다.';
      let start: Step;
      if (requestType === 'chat') {
        start = {
          id: 'chat-step',
          nodeId: 'chat.basic',
          params: async (c) => {
            let historyText = '';
            try {
              const res = await c.tools?.invoke<ChatHistoryIn, ChatHistoryOut>('chat.history', { limit: 10 });
              if (res?.ok) {
                historyText = formatHistory(res.data.items);
              }
            } catch (err) {
              if (DEBUG) console.debug('[gw] chat.history failed', formatError(err));
            }
            const parts: string[] = [];
            if (contextText && contextText.trim()) parts.push(`맥락:\n${contextText}`);
            if (historyText) parts.push(`최근 채팅(최대 10개):\n${historyText}`);
            if (DEBUG) console.debug(`[gw] chat.params hasHistory=${Boolean(historyText)} hasContext=${Boolean(contextText)}`);
            return {
              persona: defaultPersona,
              userSuffix: parts.length ? `\n${parts.join('\n\n')}` : ''
            };
          },
          next: null
        };
      } else {
        throw new Error(`Unsupported requestType: ${requestType}`);
      }
      if (DEBUG) console.debug(`[gw] pipeline.begin node=${start.nodeId}`);
      const done = await runPipeline({ start, ctx, registry: InMemoryNodeRegistry, exec });
      if (DEBUG) console.debug('[gw] pipeline.done');
      const text = getLastOutputText(done.scratch) ?? fallbackChatText;
      if (DEBUG) console.debug(`[gw] out chars=${text.length}`);
      return { cmd: requestType, body: text };
    } catch (e) {
      if (DEBUG) console.debug('[gw] error', formatError(e));
      return { cmd: requestType, body: fallbackChatText };
    }
  });
}
