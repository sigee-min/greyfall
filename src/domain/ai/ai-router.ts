import type { PublishLobbyMessage } from '../chat/use-lobby-chat';
import type { SessionParticipant } from '../session/types';
import type { LlmManagerKind } from '../../llm/qwen-webgpu';
import { guideDisplayName } from '../llm/guide-profile';
import { nanoid } from 'nanoid';

export type AICommand = {
  cmd: string;
  body?: unknown;
};

export type RouterContext = {
  manager: LlmManagerKind;
  publishLobbyMessage: PublishLobbyMessage;
  participants: SessionParticipant[];
  localParticipantId: string | null;
};

export function parseAICommand(text: string): AICommand | null {
  try {
    const obj = JSON.parse(text) as unknown;
    if (!obj || typeof obj !== 'object') return null;
    const cmd = (obj as { cmd?: unknown }).cmd;
    if (typeof cmd !== 'string' || !cmd) return null;
    const body = (obj as { body?: unknown }).body;
    return { cmd, body };
  } catch {
    return null;
  }
}

export function executeAICommand(command: AICommand, ctx: RouterContext): boolean {
  const kind = command.cmd.trim().toLowerCase();
  switch (kind) {
    case 'chat':
      return handleChat(command.body, ctx);
    default:
      console.warn('[ai] unknown command', { cmd: command.cmd });
      return false;
  }
}

function handleChat(body: unknown, ctx: RouterContext): boolean {
  const content = normaliseBody(body);
  if (!content) return false;

  const guideName = guideDisplayName(ctx.manager);
  const authorId = ctx.localParticipantId ? `guide:${ctx.localParticipantId}` : 'guide:host';

  const entry = {
    id: nanoid(12),
    authorId,
    authorName: guideName,
    authorTag: '#GUIDE',
    authorRole: 'host' as const,
    body: content,
    at: Date.now()
  };

  return ctx.publishLobbyMessage('chat', { entry }, 'ai-command:chat');
}

function normaliseBody(body: unknown): string | null {
  if (typeof body === 'string') return body.trim() || null;
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const candidates = ['text', 'content', 'message', 'body'];
    for (const key of candidates) {
      const v = obj[key];
      if (typeof v === 'string') return v.trim() || null;
    }
    try {
      const json = JSON.stringify(body);
      return json.length <= 2000 ? json : json.slice(0, 2000);
    } catch {
      return null;
    }
  }
  return null;
}

