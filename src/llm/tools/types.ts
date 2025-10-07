export type ToolResult<T = unknown> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error: string };

export type ToolCtx = {
  manager: 'fast' | 'smart';
  signal?: AbortSignal;
  // Optional session-bound providers (wire actual game data here)
  providers?: {
    getChatHistory?: (limit: number, includeSystem?: boolean) => Promise<Array<{ author: string; role: 'user' | 'assistant' | 'system'; body: string; at: number }>>;
  };
};

export type Tool<TIn = unknown, TOut = unknown> = {
  id: string;
  doc?: string;
  // Basic runtime guards (keep them lightweight here; full zod schemas can be added later)
  inputGuard?: (input: unknown) => asserts input is TIn;
  outputGuard?: (data: unknown) => asserts data is TOut;
  invoke: (ctx: ToolCtx, input: TIn) => Promise<ToolResult<TOut>>;
};

export type ToolRegistry = {
  register<TIn = unknown, TOut = unknown>(tool: Tool<TIn, TOut>): void;
  get<TIn = unknown, TOut = unknown>(id: string): Tool<TIn, TOut> | null;
  list(): Tool[];
};

export type ToolsHost = {
  invoke<TIn = unknown, TOut = unknown>(id: string, input: TIn, opts?: { cacheKey?: string; ttlMs?: number }): Promise<ToolResult<TOut>>;
};
