import type { Tool, ToolRegistry } from './types';

const MAP = new Map<string, Tool>();

export const InMemoryToolRegistry: ToolRegistry = {
  register(tool: Tool): void {
    MAP.set(tool.id, tool);
  },
  get(id: string): Tool | null {
    return MAP.get(id) ?? null;
  },
  list(): Tool[] {
    return Array.from(MAP.values());
  }
};

