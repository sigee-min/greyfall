import { z } from 'zod';
import { guideDisplayName } from '../../llm/guide-profile.js';
import { nanoid } from 'nanoid';
// 단일 고정 타입: string (프로토콜의 body와 동일)
const ChatBodySchema = z.string().min(1);
function coerceToString(input) {
    if (typeof input === 'string')
        return input.trim();
    if (input && typeof input === 'object') {
        const obj = input;
        const text = ['text', 'content', 'message']
            .map((k) => obj[k])
            .find((v) => typeof v === 'string' && v.trim());
        if (text)
            return text.trim();
        try {
            return JSON.stringify(input);
        }
        catch {
            return '';
        }
    }
    return '';
}
export const ChatCommand = {
    cmd: 'chat',
    schema: ChatBodySchema,
    doc: 'chat — 안내인 이름으로 채팅 전송. body는 string 고정.',
    policy: { role: 'host', cooldownMs: 2500 },
    coerce: coerceToString,
    handler: (text, ctx) => {
        const body = (text ?? '').toString().trim();
        if (!body)
            return false;
        const guide = guideDisplayName(ctx.manager);
        const authorId = ctx.localParticipantId ? `guide:${ctx.localParticipantId}` : 'guide:host';
        const entry = {
            id: nanoid(12),
            authorId,
            authorName: guide,
            authorTag: '#GUIDE',
            authorRole: 'host',
            body,
            at: Date.now()
        };
        return ctx.publishLobbyMessage('chat', { entry }, 'ai:chat');
    }
};
