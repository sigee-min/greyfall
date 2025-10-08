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
import { buildSystemFromSections, type SectionBundle, planDirectives, narrateDirectives } from '../../llm/spec/prompts';
import { buildEligibilitySections } from './gateway/eligibility';

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
    locale,
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
      scratch: { overrides: { temperature, maxTokens: maxTok, timeoutMs: Math.min(60_000, Math.max(3_000, effectiveTimeout)), locale: locale === 'en' ? 'en' : 'ko' } },
      tools: makeDefaultToolsHost({ manager, providers: getToolsProviders() })
    };
    try {
      const defaultPersona = persona ?? '너는 Greyfall 게임 매니저이다.';
      const buildSections = async (): Promise<SectionBundle> => {
        let historyText = '';
        try {
          const res = await ctx.tools?.invoke<ChatHistoryIn, ChatHistoryOut>('chat.history', { limit: 10 });
          if (res?.ok) historyText = formatHistory(res.data.items);
        } catch (err) {
          if (DEBUG) console.debug('[gw] chat.history failed', formatError(err));
        }
        let s: SectionBundle = { ...(params.sections ?? {}) };
        if (params.eligibility) {
          try {
            const built = buildEligibilitySections(params.eligibility);
            s = { ...built, ...s };
          } catch (e) {
            if (DEBUG) console.debug('[gw] eligibility build failed', formatError(e));
          }
        }
        if (contextText && contextText.trim()) s.context = contextText;
        if (historyText) s.recentChat = historyText;
        if (!s.requester && params.actorId) s.requester = `actor=${params.actorId} (self)`;
        return s;
      };

      let start: Step;
      if (requestType === 'chat') {
        start = {
          id: 'chat.basic',
          nodeId: 'chat.basic',
          params: async () => {
            const sections = await buildSections();
            const systemSuffix = buildSystemFromSections('', sections); // persona provided separately
            return { persona: defaultPersona, systemSuffix, userSuffix: '' };
          },
          next: null
        };
      } else if (requestType === 'intent.plan') {
        start = {
          id: 'intent.plan',
          nodeId: 'intent.plan',
          params: async () => {
            const sections = await buildSections();
            const systemSuffix = buildSystemFromSections('', sections);
            const directive = planDirectives(locale === 'en' ? 'en' : 'ko');
            return { persona: defaultPersona, systemSuffix, userSuffix: '', directive };
          },
          next: null
        };
      } else if (requestType === 'result.narrate') {
        start = {
          id: 'result.narrate',
          nodeId: 'result.narrate',
          params: async () => {
            const sections = await buildSections();
            const systemSuffix = buildSystemFromSections('', sections);
            const directive = narrateDirectives(locale === 'en' ? 'en' : 'ko');
            return { persona: defaultPersona, systemSuffix, userSuffix: '', directive };
          },
          next: null
        };
      } else if (requestType === 'rules.extract') {
        start = {
          id: 'rules.extract', nodeId: 'rules.extract',
          params: async () => {
            const sections = await buildSections();
            const systemSuffix = buildSystemFromSections('', sections);
            const directive = planDirectives(locale === 'en' ? 'en' : 'ko'); // reuse minimal directive if needed; node adds own
            return { persona: defaultPersona, systemSuffix, userSuffix: '', directive };
          }, next: null
        };
      } else if (requestType === 'rules.narrate') {
        start = {
          id: 'rules.narrate', nodeId: 'rules.narrate',
          params: async () => {
            const sections = await buildSections();
            const systemSuffix = buildSystemFromSections('', sections);
            const directive = '규칙 발췌를 1–2문장으로 설명합니다.';
            return { persona: defaultPersona, systemSuffix, userSuffix: '', directive };
          }, next: null
        };
      } else if (requestType === 'scene.brief') {
        start = { id: 'scene.brief', nodeId: 'scene.brief', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = '장면 요약 1–3문장';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'scene.detail') {
        start = { id: 'scene.detail', nodeId: 'scene.detail', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = '지정된 요소를 1–2문장 확장';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'turn.summarize') {
        start = { id: 'turn.summarize', nodeId: 'turn.summarize', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = '핵심을 bullet 2–3개로 요약하고 JSON 한 줄로 내보냅니다.';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'session.summarize') {
        start = { id: 'session.summarize', nodeId: 'session.summarize', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = '세션 저장용 2–3문장 요약';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'npc.reply') {
        start = { id: 'npc.reply', nodeId: 'npc.reply', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = 'NPC 말투로 1–2문장으로 답변합니다.';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'npc.name') {
        start = { id: 'npc.name', nodeId: 'npc.name', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = 'JSON 한 줄 {"names":["..",".."]}';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'entity.link') {
        start = { id: 'entity.link', nodeId: 'entity.link', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = '지칭을 액터 ID로 매핑하고 JSON 한 줄로 출력';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'intent.disambiguate') {
        start = { id: 'intent.disambiguate', nodeId: 'intent.disambiguate', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = '확인 질문과 2–4개 선택지를 JSON 한 줄로 출력';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'turn.suggest') {
        start = { id: 'turn.suggest', nodeId: 'turn.suggest', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = '다음 전개 제안 2–3개를 JSON 한 줄로 출력';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'scene.hazard.tag') {
        start = { id: 'scene.hazard.tag', nodeId: 'scene.hazard.tag', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = '위험을 최대 2개 선택하여 JSON 한 줄로 출력';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else if (requestType === 'safety.screen') {
        start = { id: 'safety.screen', nodeId: 'safety.screen', params: async () => {
          const sections = await buildSections(); const systemSuffix = buildSystemFromSections('', sections); const directive = 'JSON 한 줄 {"flag":true|false,"reasons":[".."],"suggest":".."}';
          return { persona: defaultPersona, systemSuffix, userSuffix: '', directive }; }, next: null };
      } else {
        throw new Error(`Unsupported requestType: ${requestType}`);
      }
      if (DEBUG) console.debug(`[gw] pipeline.begin node=${start.nodeId}`);
      const task = requestType; // tag stream meta with requestType for export mapping
      const exec: MessageExecutor = async (msgs, opts) => {
        if (DEBUG) console.debug(`[gw.exec] run messages=${msgs.length} temp=${opts.temperature} maxTokens=${opts.maxTokens} timeout=${opts.timeoutMs} task=${task}`);
        const out = await generateMessagesWithTimeout(manager, msgs, { ...opts, locale, task });
        if (DEBUG) console.debug(`[gw.exec] done chars=${out.length}`);
        return out;
      };
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
