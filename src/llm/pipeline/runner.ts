import { emitProgress } from '../progress-bus';
import type { ChatMessage } from '../../domain/ai/gateway/llm-exec';
import { renderTemplate, withTimeoutRetry } from './utils';
import type { MessageExecutor, NodeRegistry, PipelineCtx, Step } from './types';

export async function runPipeline(options: {
  start: Step;
  ctx: PipelineCtx;
  registry: NodeRegistry;
  exec: MessageExecutor; // Transformers.js branch now; TODO: add WebLLM branch later
}): Promise<PipelineCtx> {
  const { start, ctx, registry, exec } = options;
  let cur: Step | null = start;
  while (cur) {
    const step: Step = cur;
    const node = registry.get(step.nodeId);
    if (!node) throw new Error(`Unknown node: ${step.nodeId}`);
    const params = await step.params(ctx);
    const sys = renderTemplate(node.prompt.systemTpl, params);
    const userSuffix = node.prompt.userTpl ? renderTemplate(node.prompt.userTpl, params) : '';
    const messages: ChatMessage[] = [
      { role: 'system', content: sys },
      { role: 'user', content: [ctx.user, userSuffix].filter(Boolean).join('\n') }
    ];
    emitProgress({ text: `${step.id} 실행`, progress: null });
    try {
      const overrides: any = (ctx as any)?.scratch?.overrides || {};
      const temperature = (overrides.temperature as number | undefined) ?? node.options?.temperature ?? 0.7;
      const maxTokens = (overrides.maxTokens as number | undefined) ?? node.options?.maxTokens ?? 512;
      const timeoutMs = (overrides.timeoutMs as number | undefined) ?? node.options?.timeoutMs ?? 20000;
      const retries = node.options?.retries ?? 0;
      const raw = await withTimeoutRetry(
        () => exec(messages, { temperature, maxTokens, timeoutMs, signal: ctx.signal }),
        { timeoutMs, retries, signal: ctx.signal }
      );
      const text = node.validate ? (await node.validate(raw, ctx)).fixed ?? raw : raw;
      // Store last output into scratch for downstream steps
      ctx.scratch.last = { nodeId: node.id, text };
      cur = step.next ?? null;
    } catch (err) {
      emitProgress({ text: `${step.id} 실패: ${String((err as any)?.message || err)}`, progress: null });
      if (step.onErrorNext) { cur = step.onErrorNext; continue; }
      throw err;
    }
  }
  emitProgress({ text: '파이프라인 완료', progress: 1 });
  return ctx;
}
