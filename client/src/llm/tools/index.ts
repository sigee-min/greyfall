import { InMemoryToolRegistry } from './registry';
import { InMemoryToolsHost } from './host';
import type { ToolCtx, ToolsHost } from './types';
import { ChatHistoryTool } from './impl/chat-history';

// Pre-register built-in tools
InMemoryToolRegistry.register(ChatHistoryTool);

export function makeDefaultToolsHost(base: Omit<ToolCtx, 'providers'> & { providers?: ToolCtx['providers'] }): ToolsHost {
  return new InMemoryToolsHost(InMemoryToolRegistry, base);
}

export { InMemoryToolRegistry } from './registry';
export * from './types';

