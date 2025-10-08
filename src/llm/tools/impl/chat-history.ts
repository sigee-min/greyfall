import type { Tool } from '../types';

export type ChatHistoryIn = { limit?: number; includeSystem?: boolean };
export type ChatHistoryOut = { items: Array<{ author: string; role: 'user' | 'assistant' | 'system'; body: string; at: number }>; };

export const ChatHistoryTool: Tool<ChatHistoryIn, ChatHistoryOut> = {
  id: 'chat.history',
  doc: '최근 채팅 메시지 최대 10개를 반환',
  inputGuard: (input: unknown): asserts input is ChatHistoryIn => {
    const i = (input || {}) as ChatHistoryIn;
    if (i.limit != null && (typeof i.limit !== 'number' || i.limit < 1 || i.limit > 10)) throw new Error('limit:1..10');
    if (i.includeSystem != null && typeof i.includeSystem !== 'boolean') throw new Error('includeSystem:boolean');
  },
  outputGuard: (data: unknown): asserts data is ChatHistoryOut => {
    if (!data || typeof data !== 'object') throw new Error('invalid output');
    const record = data as Record<string, unknown>;
    if (!Array.isArray(record.items)) throw new Error('invalid output');
    for (const item of record.items) {
      if (!item || typeof item !== 'object') throw new Error('invalid output');
      const entry = item as Record<string, unknown>;
      if (typeof entry.author !== 'string' || typeof entry.body !== 'string' || typeof entry.at !== 'number') {
        throw new Error('invalid output');
      }
      if (!['user', 'assistant', 'system'].includes(entry.role as string)) {
        throw new Error('invalid output');
      }
    }
  },
  async invoke(ctx, input) {
    const limit = input.limit ?? 10;
    const includeSystem = input.includeSystem ?? false;
    const prov = ctx.providers?.getChatHistory;
    if (!prov) return { ok: false, error: 'no-provider:getChatHistory' };
    const raw = await prov(limit, includeSystem);
    return { ok: true, data: { items: raw } };
  }
};
