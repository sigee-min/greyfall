import { z } from 'zod';
import type { CommandSpec } from '../command-registry';
import { guideDisplayName } from '../../llm/guide-profile';
import { nanoid } from 'nanoid';

// 단일 고정 타입: object with { text: string }
const ChatBodySchema = z
  .object({
    text: z.string().min(1)
  })
  .passthrough();

function coerceToChatBody(input: unknown): unknown {
  if (typeof input === 'string') return { text: input };
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const text = ['text', 'content', 'message'].map((k) => obj[k]).find((v) => typeof v === 'string' && v.trim()) as
      | string
      | undefined;
    if (text && text.trim()) return { ...obj, text: text.trim() };
    try {
      return { text: JSON.stringify(input) };
    } catch {
      return { text: '' };
    }
  }
  return { text: '' };
}

export const ChatCommand: CommandSpec<{ text: string }> = {
  cmd: 'chat',
  schema: ChatBodySchema,
  doc: 'chat — 안내인 이름으로 채팅 전송. body는 { text: string } 고정.',
  policy: { role: 'host', cooldownMs: 2500 },
  coerce: coerceToChatBody,
  handler: (args, ctx) => {
    const text = args.text.trim();
    if (!text) return false;
    const guide = guideDisplayName(ctx.manager);
    const authorId = ctx.localParticipantId ? `guide:${ctx.localParticipantId}` : 'guide:host';
    const entry = {
      id: nanoid(12),
      authorId,
      authorName: guide,
      authorTag: '#GUIDE',
      authorRole: 'host' as const,
      body: text,
      at: Date.now()
    };
    return ctx.publishLobbyMessage('chat', { entry }, 'ai:chat');
  }
};
