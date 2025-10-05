import { useEffect, useMemo, useRef } from 'react';
import type { LlmManagerKind } from '../../llm/qwen-webgpu';
import { generateQwenChat } from '../../llm/qwen-webgpu';
import { guideDisplayName } from './guide-profile';
import type { RegisterLobbyHandler, PublishLobbyMessage } from '../chat/use-lobby-chat';
import type { SessionParticipant } from '../session/types';
import { nanoid } from 'nanoid';

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
  const guideName = useMemo(() => guideDisplayName(manager), [manager]);
  const authorId = useMemo(() => (localParticipantId ? `guide:${localParticipantId}` : 'guide:host'), [localParticipantId]);
  // Keep for potential future use: local participant snapshot
  // const self = useMemo(() => participants.find((p) => p.id === localParticipantId) ?? null, [participants, localParticipantId]);
  const fullPolicy: GuideAgentPolicy = useMemo(
    () => ({
      respondOnMention: true,
      mentionAliases: ['안내인', '가이드', 'guide', 'bot'],
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
          const sys = buildSystemPrompt(guideName);
          const context = historyRef.current
            .slice(-fullPolicy.maxContext)
            .map((m) => `- ${m.role === 'assistant' ? '(안내인) ' : ''}${m.content}`)
            .join('\n');
          const userPrompt = `대화 맥락:\n${context}\n\n마지막 요청에 1~2문장으로 간결하게 답하라. 존칭 유지.`;
          const reply = (await generateQwenChat(userPrompt, {
            systemPrompt: sys,
            temperature: 0.4,
            topP: 0.9,
            maxTokens: fullPolicy.maxTokens
          })).trim();

          if (reply) {
            pushHistory(historyRef, { role: 'assistant', content: `${guideName}: ${reply}` }, fullPolicy.maxContext);
            const entryOut = {
              id: nanoid(12),
              authorId,
              authorName: guideName,
              authorTag: '#GUIDE',
              authorRole: 'host' as const,
              body: reply,
              at: Date.now()
            };
            publishLobbyMessage('chat', { entry: entryOut }, 'guide-reply');
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
  }, [authorId, enabled, fullPolicy, guideName, publishLobbyMessage, registerLobbyHandler]);
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

function buildSystemPrompt(name: string): string {
  return [
    `당신은 작전 안내인 “${name}”입니다.`,
    '규칙:',
    '- 한국어 존댓말 사용',
    '- 1~2문장, 간결/실용적으로 답변',
    '- 불확실하면 추가 정보 요청',
    '- 코드/명령은 짧고 명확하게',
  ].join('\n');
}
