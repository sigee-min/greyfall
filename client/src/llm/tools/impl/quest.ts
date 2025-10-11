import type { Tool } from '../types';

export const QuestAcceptTool: Tool<{ questId: string }, { ok: true }> = {
  id: 'quest.accept',
  doc: '지정된 퀘스트를 수락(호스트 전용)',
  inputGuard: (input: unknown): asserts input is { questId: string } => {
    const i = input as any;
    if (!i || typeof i.questId !== 'string' || i.questId.length < 1) throw new Error('questId:string');
  },
  outputGuard: (_: unknown): asserts _ is { ok: true } => {},
  async invoke(ctx, input) {
    const prov = ctx.providers;
    if (!prov?.isHost || !prov.isHost()) return { ok: false, error: 'not-host' };
    if (!prov.questAccept) return { ok: false, error: 'no-provider:questAccept' };
    const ok = await prov.questAccept(input.questId);
    return ok ? { ok: true, data: { ok: true } } : { ok: false, error: 'accept-failed' };
  }
};

export const QuestProgressTool: Tool<{ questId: string; objectiveId: string; delta?: number }, { ok: true }> = {
  id: 'quest.progress',
  doc: '목표 진행 갱신(호스트 전용)',
  inputGuard: (input: unknown): asserts input is { questId: string; objectiveId: string; delta?: number } => {
    const i = input as any;
    if (!i || typeof i.questId !== 'string' || i.questId.length < 1) throw new Error('questId:string');
    if (typeof i.objectiveId !== 'string' || i.objectiveId.length < 1) throw new Error('objectiveId:string');
    if (i.delta != null && (typeof i.delta !== 'number' || !isFinite(i.delta))) throw new Error('delta:number');
  },
  outputGuard: (_: unknown): asserts _ is { ok: true } => {},
  async invoke(ctx, input) {
    const prov = ctx.providers;
    if (!prov?.isHost || !prov.isHost()) return { ok: false, error: 'not-host' };
    if (!prov.questProgress) return { ok: false, error: 'no-provider:questProgress' };
    const ok = await prov.questProgress({ questId: input.questId, objectiveId: input.objectiveId, delta: input.delta ?? 1 });
    return ok ? { ok: true, data: { ok: true } } : { ok: false, error: 'progress-failed' };
  }
};

export const QuestCompleteTool: Tool<{ questId: string }, { ok: true }> = {
  id: 'quest.complete',
  doc: '퀘스트 완료 처리(호스트 전용)',
  inputGuard: (input: unknown): asserts input is { questId: string } => {
    const i = input as any;
    if (!i || typeof i.questId !== 'string' || i.questId.length < 1) throw new Error('questId:string');
  },
  outputGuard: (_: unknown): asserts _ is { ok: true } => {},
  async invoke(ctx, input) {
    const prov = ctx.providers;
    if (!prov?.isHost || !prov.isHost()) return { ok: false, error: 'not-host' };
    if (!prov.questComplete) return { ok: false, error: 'no-provider:questComplete' };
    const ok = await prov.questComplete(input.questId);
    return ok ? { ok: true, data: { ok: true } } : { ok: false, error: 'complete-failed' };
  }
};

export const QuestFailTool: Tool<{ questId: string; reason?: string }, { ok: true }> = {
  id: 'quest.fail',
  doc: '퀘스트 실패 처리(호스트 전용)',
  inputGuard: (input: unknown): asserts input is { questId: string; reason?: string } => {
    const i = input as any;
    if (!i || typeof i.questId !== 'string' || i.questId.length < 1) throw new Error('questId:string');
    if (i.reason != null && typeof i.reason !== 'string') throw new Error('reason:string');
  },
  outputGuard: (_: unknown): asserts _ is { ok: true } => {},
  async invoke(ctx, input) {
    const prov = ctx.providers;
    if (!prov?.isHost || !prov.isHost()) return { ok: false, error: 'not-host' };
    if (!prov.questFail) return { ok: false, error: 'no-provider:questFail' };
    const ok = await prov.questFail({ questId: input.questId, reason: input.reason });
    return ok ? { ok: true, data: { ok: true } } : { ok: false, error: 'fail-failed' };
  }
};

