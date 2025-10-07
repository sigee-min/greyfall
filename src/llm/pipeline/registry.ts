import type { NodeRegistry, NodeTemplate } from './types';
import { ChatBasicNode } from './nodes/chat.basic';
import { CmdChooseNode } from './nodes/cmd.choose';

const NODE_MAP = new Map<string, NodeTemplate>([
  [ChatBasicNode.id, ChatBasicNode],
  [CmdChooseNode.id, CmdChooseNode]
]);

export const InMemoryNodeRegistry: NodeRegistry = {
  get(nodeId: string): NodeTemplate | null {
    return NODE_MAP.get(nodeId) ?? null;
  }
};
