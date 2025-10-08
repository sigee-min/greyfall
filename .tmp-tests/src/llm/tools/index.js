import { InMemoryToolRegistry } from './registry';
import { InMemoryToolsHost } from './host';
import { ChatHistoryTool } from './impl/chat-history';
// Pre-register built-in tools
InMemoryToolRegistry.register(ChatHistoryTool);
export function makeDefaultToolsHost(base) {
    return new InMemoryToolsHost(InMemoryToolRegistry, base);
}
export { InMemoryToolRegistry } from './registry';
export * from './types';
