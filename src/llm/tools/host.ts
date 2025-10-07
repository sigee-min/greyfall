import type { ToolRegistry, ToolsHost, ToolResult, ToolCtx } from './types';

type CacheEntry = { expiresAt: number; result: ToolResult };

export class InMemoryToolsHost implements ToolsHost {
  private cache = new Map<string, CacheEntry>();
  constructor(private registry: ToolRegistry, private baseCtx: Omit<ToolCtx, 'providers'> & { providers?: ToolCtx['providers'] }) {}

  async invoke<TIn, TOut>(id: string, input: TIn, opts?: { cacheKey?: string; ttlMs?: number }): Promise<ToolResult<TOut>> {
    const tool = this.registry.get<TIn, TOut>(id);
    if (!tool) return { ok: false, error: `unknown-tool:${id}` };

    const key = opts?.cacheKey ? `${id}:${opts.cacheKey}` : null;
    if (key && this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      if (Date.now() < entry.expiresAt) return entry.result as ToolResult<TOut>;
      this.cache.delete(key);
    }

    try {
      if (tool.inputGuard) {
        const guard: (value: unknown) => asserts value is TIn = tool.inputGuard;
        guard(input);
      }
      const result = await tool.invoke(this.baseCtx as ToolCtx, input);
      if (result.ok && tool.outputGuard) {
        const guard: (value: unknown) => asserts value is TOut = tool.outputGuard;
        guard(result.data);
      }
      if (key && opts?.ttlMs) this.cache.set(key, { expiresAt: Date.now() + Math.max(100, opts.ttlMs), result });
      return result as ToolResult<TOut>;
    } catch (err) {
      return { ok: false, error: String((err as any)?.message || err) } as ToolResult<TOut>;
    }
  }
}
