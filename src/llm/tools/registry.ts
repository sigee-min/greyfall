import type { Tool, ToolRegistry } from './types';

const MAP = new Map<string, Tool<unknown, unknown>>();

export const InMemoryToolRegistry: ToolRegistry = {
  register<TIn = unknown, TOut = unknown>(tool: Tool<TIn, TOut>): void {
    MAP.set(tool.id, tool as Tool<unknown, unknown>);
  },
  get<TIn = unknown, TOut = unknown>(id: string): Tool<TIn, TOut> | null {
    return (MAP.get(id) as Tool<TIn, TOut> | undefined) ?? null;
  },
  list(): Tool[] {
    return Array.from(MAP.values());
  }
};
