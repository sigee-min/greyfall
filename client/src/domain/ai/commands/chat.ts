import { z } from 'zod';
import type { CommandSpec } from '../command-registry';
import { nanoid } from 'nanoid';

// 단일 고정 타입: string (프로토콜의 body와 동일)
const ChatBodySchema = z.string().min(1);

function coerceToString(input: unknown): unknown {
  if (typeof input === 'string') return input.trim();
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const text = ['text', 'content', 'message']
      .map((k) => obj[k])
      .find((v) => typeof v === 'string' && v.trim()) as string | undefined;
    if (text) return text.trim();
    try {
      return JSON.stringify(input);
    } catch {
      return '';
    }
  }
  return '';
}

export const ChatCommand: CommandSpec<string> = {
  cmd: 'chat',
  schema: ChatBodySchema,
  doc: 'chat — 심판자 이름으로 채팅 전송. body는 string 고정.',
  policy: { role: 'host', cooldownMs: 2500 },
  coerce: coerceToString,
  handler: (text, ctx) => {
    const body = (text ?? '').toString().trim();
    if (!body) return false;
    const guide = '심판자';
    const authorId = ctx.localParticipantId ? `ai:${ctx.localParticipantId}` : 'ai:host';
    const entry = {
      id: nanoid(12),
      authorId,
      authorName: guide,
      authorTag: '#GUIDE',
      authorRole: 'host' as const,
      body,
      at: Date.now()
    };
    return ctx.publishLobbyMessage('chat', { entry }, 'ai:chat');
  }
};
