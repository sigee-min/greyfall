import { useEffect, useMemo, useRef } from 'react';
import type { LlmManagerKind } from '../../llm/llm-engine';
// LLM 호출은 ai-gateway 단일 창구를 사용합니다.
import type { RegisterLobbyHandler, PublishLobbyMessage } from '../chat/use-lobby-chat';
import type { SessionParticipant } from '../session/types';
// import { nanoid } from 'nanoid';
import { executeAICommand } from '../ai/ai-router';
import { requestAICommand } from '../ai/ai-gateway';

export type GuideAgentPolicy = {
  respondOnMention: boolean;
  mentionAliases?: string[];
  cooldownMs: number;
  maxContext: number;
  maxTokens: number;
};

export type UseGuideAgentOptions = {
  enabled: boolean;
  manager: LlmManagerKind;
  registerLobbyHandler: RegisterLobbyHandler;
  publishLobbyMessage: PublishLobbyMessage;
  localParticipantId: string | null;
  participants: SessionParticipant[];
  policy?: Partial<GuideAgentPolicy>;
};

export function useGuideAgent({
  enabled,
  manager,
  registerLobbyHandler,
  publishLobbyMessage,
  localParticipantId,
  participants: _participants,
  policy
}: UseGuideAgentOptions) {
  const guideName = useMemo(() => '심판자', []);
  const authorId = useMemo(() => (localParticipantId ? `guide:${localParticipantId}` : 'guide:host'), [localParticipantId]);
  // Keep for potential future use: local participant snapshot
  // const self = useMemo(() => participants.find((p) => p.id === localParticipantId) ?? null, [participants, localParticipantId]);
  const fullPolicy: GuideAgentPolicy = useMemo(
    () => ({
      respondOnMention: true,
      mentionAliases: ['심판자', '안내인', '가이드', 'guide', 'bot'],
      cooldownMs: 3500,
      maxContext: 8,
      maxTokens: 160,
      ...policy
    }),
    [policy]
  );

  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const lastAtRef = useRef(0);
  const pendingRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // Subscribe to chat stream
    const unsubscribe = registerLobbyHandler('chat', async (message) => {
      const entry = message.body.entry;

      // Keep a rolling text history (names included for grounding)
      const who = `${entry.authorName}`;
      const line = `${who}: ${entry.body}`;

      // Filter out agent's own messages
      const isFromAgent = entry.authorId === authorId;
      if (!isFromAgent) {
        pushHistory(historyRef, { role: 'user', content: line }, fullPolicy.maxContext);
      }

      if (!shouldReply(entry.body, guideName, fullPolicy)) return;

      // Respect cooldown
      const now = Date.now();
      if (now - lastAtRef.current < fullPolicy.cooldownMs) return;

      // Prevent concurrent generations
      if (pendingRef.current) return;

      pendingRef.current = (async () => {
        try {
          const context = historyRef.current
            .slice(-fullPolicy.maxContext)
            .map((m) => `- ${m.role === 'assistant' ? '(심판자) ' : ''}${m.content}`)
            .join('\n');
          const prompt = [
            `${guideName}로서 아래 플레이어 발언에 응답해 주세요.`,
            `플레이어 발언: ${entry.body}`
          ].join('\n\n');
          const parsed = await requestAICommand({
            manager,
            actorId: authorId,
            requestType: 'chat',
            persona: `${guideName}는 Greyfall 콘솔의 심판자다. 한국어로만 친근하게 말한다.`,
            userInstruction: prompt,
            contextText: context,
            temperature: 0.4,
            maxTokens: fullPolicy.maxTokens,
            fallbackChatText: '요청하신 내용을 이해하지 못했습니다.'
          });

          const executed = await executeAICommand(parsed, {
            manager,
            publishLobbyMessage,
            participants: _participants,
            localParticipantId
          });

          // 히스토리 저장용: 사용자에게 보이는 실제 바디만 기록
          const bodyText = typeof parsed.body === 'string' ? parsed.body : JSON.stringify(parsed.body);
          if (executed && bodyText) {
            pushHistory(historyRef, { role: 'assistant', content: `${guideName}: ${bodyText}` }, fullPolicy.maxContext);
            lastAtRef.current = Date.now();
          }
        } catch (err) {
          // Swallow; do not spam errors to chat
          console.warn('[guide] generate reply failed', err);
        } finally {
          pendingRef.current = null;
        }
      })();
    });
    return unsubscribe;
  }, [authorId, enabled, fullPolicy, guideName, publishLobbyMessage, registerLobbyHandler, _participants, localParticipantId, manager]);
}

function pushHistory(ref: { current: { role: 'user' | 'assistant'; content: string }[] }, item: { role: 'user' | 'assistant'; content: string }, max: number) {
  ref.current = [...ref.current, item].slice(-max);
}

function shouldReply(text: string, name: string, policy: GuideAgentPolicy): boolean {
  if (!policy.respondOnMention) return false;
  const t = text.toLowerCase();
  const nameLc = name.toLowerCase();
  if (t.includes(nameLc)) return true;
  if (t.includes('@' + nameLc)) return true;
  for (const alias of policy.mentionAliases ?? []) {
    const a = alias.toLowerCase();
    if (t.includes(a) || t.includes('@' + a)) return true;
  }
  return false;
}

// System 프롬프트는 ai-gateway에서 페르소나 + 명령 레지스트리를 기반으로 구성합니다.
