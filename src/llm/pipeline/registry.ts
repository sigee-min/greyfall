import type { NodeRegistry, NodeTemplate } from './types';
import { ChatBasicNode } from './nodes/chat.basic';

const NODE_MAP = new Map<string, NodeTemplate>([[ChatBasicNode.id, ChatBasicNode]]);

export const InMemoryNodeRegistry: NodeRegistry = {
  get(nodeId: string): NodeTemplate | null {
    return NODE_MAP.get(nodeId) ?? null;
  }
};
