import { z } from 'zod';
import { guideDisplayName } from '../../llm/guide-profile.js';
import { probeChatApiReady } from '../../../llm/qwen-webgpu';
import { nanoid } from 'nanoid';
export const ReadyzCommand = {
    cmd: 'llm.readyz',
    schema: z.string(),
    doc: 'llm.readyz — LLM 준비 상태 헬스체크. body는 비워도 됩니다.',
    policy: { role: 'host', cooldownMs: 1500 },
    handler: async (_text, ctx) => {
        // Non-blocking probe; does not trigger model download
        const probe = await probeChatApiReady(600);
        const name = guideDisplayName(ctx.manager);
        const status = probe.initialised
            ? probe.chatApiReady
                ? '준비됨'
                : '초기화 진행 중'
            : '엔진 미초기화';
        const entry = {
            id: nanoid(12),
            authorId: ctx.localParticipantId ? `guide:${ctx.localParticipantId}` : 'guide:host',
            authorName: name,
            authorTag: '#GUIDE',
            authorRole: 'host',
            body: `심판자 상태 점검: ${status}`,
            at: Date.now()
        };
        return ctx.publishLobbyMessage('chat', { entry }, 'ai:readyz');
    }
};
