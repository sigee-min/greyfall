import { defineSyncModel, registerSyncModel } from '../net-objects/index.js';
import { getHostObject } from '../net-objects/registry.js';
import { CHAT_OBJECT_ID } from '../net-objects/chat.js';
import type { HostObject } from '../net-objects/types.js';
import type { LobbyParticipant } from '../../protocol/index.js';
import { getLimiter } from '../net-objects/policies.js';
import { requestAICommand } from '../ai/ai-gateway';

type VoidState = null;

type ChatEntry = {
  id: string;
  authorId: string;
  authorName: string;
  authorTag: string;
  authorRole: LobbyParticipant['role'];
  body: string;
  at: number;
};

type ChatHostApi = HostObject & {
  append: (entry: ChatEntry, context?: string) => void;
};

function newId(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c && 'randomUUID' in c) return (c as Crypto & { randomUUID: () => string }).randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const chatLimiter = getLimiter('chat');

const chatControl = defineSyncModel<VoidState>({
  id: 'chat:control',
  initial: () => null,
  requestOnStart: false,
  commands: [
    {
      kind: 'chat:append:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const obj = body as { body?: unknown; authorId?: unknown };
        const text = obj.body;
        const authorId = obj.authorId;
        if (typeof text !== 'string' || typeof authorId !== 'string') return null;
        return { text, authorId };
      },
      handle: async ({ payload, context }) => {
        const { text, authorId } = payload;
        const trimmed = text.trim();
        if (!trimmed) return;
        if (!chatLimiter.allow(`chat:${authorId}`)) {
          console.warn('[chat] rate limited', { authorId });
          return;
        }
        const chat = getHostObject<ChatHostApi>(CHAT_OBJECT_ID);
        if (!chat) return;
        const self = context.lobbyStore.participantsRef.current.find((p) => p.id === authorId);

        // Slash command: /llm <prompt> → post prompt, then assistant reply
        const llmMatch = /^\s*\/llm\s+([\s\S]+)$/i.exec(trimmed);
        if (llmMatch) {
          const prompt = llmMatch[1].trim();
          if (!prompt) return;
          // Echo user prompt (without /llm)
          chat.append({ id: newId(), authorId, authorName: self?.name ?? 'Host', authorTag: self?.tag ?? '#HOST', authorRole: self?.role ?? 'guest', body: prompt, at: Date.now() }, 'chat-append');
          // Ask LLM asynchronously and append reply
          try {
            const ai = await requestAICommand({
              manager: 'smart',
              requestType: 'chat',
              actorId: authorId,
              persona: '너는 Greyfall 콘솔 보조자이다. 한국어로만 말한다.',
              userInstruction: prompt,
              temperature: 0.5,
              maxTokens: undefined,
              timeoutMs: 45_000,
              fallbackChatText: '답변을 생성하지 못했습니다.'
            });
            const bodyText = typeof (ai as { body?: unknown })?.body === 'string' ? String(ai.body) : '답변을 생성하지 못했습니다.';
            chat.append({ id: newId(), authorId: 'assistant', authorName: 'Assistant', authorTag: '#LLM', authorRole: 'guest', body: bodyText, at: Date.now() }, 'chat-append');
          } catch {
            chat.append({ id: newId(), authorId: 'assistant', authorName: 'Assistant', authorTag: '#LLM', authorRole: 'guest', body: '로컬 LLM이 준비되지 않았어요. 네트워크 또는 모델 설정을 확인해 주세요.', at: Date.now() }, 'chat-append');
          }
          return;
        }

        // Normal chat append
        chat.append({ id: newId(), authorId, authorName: self?.name ?? 'Host', authorTag: self?.tag ?? '#HOST', authorRole: self?.role ?? 'guest', body: trimmed, at: Date.now() }, 'chat-append');
      }
    }
  ]
});

registerSyncModel(chatControl);
