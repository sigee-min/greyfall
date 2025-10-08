import { z } from 'zod';
// Mission start requires host role + preconditions (llmReady && everyoneReady)
export const MissionStartCommand = {
    cmd: 'mission.start',
    schema: z.any(),
    doc: 'mission.start — 임무 시작(사전조건 충족 필요: 심판자/전원 준비). body는 비워도 됩니다.',
    policy: { role: 'host', cooldownMs: 1000 },
    preconditions: (ctx) => Boolean(ctx.flags?.llmReady) && Boolean(ctx.flags?.everyoneReady),
    handler: () => true
};
