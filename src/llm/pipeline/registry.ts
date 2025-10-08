import type { NodeRegistry, NodeTemplate } from './types';
import { ChatBasicNode } from './nodes/chat.basic';
import { IntentPlanNode } from './nodes/intent.plan';
import { ResultNarrateNode } from './nodes/result.narrate';

const NODE_MAP = new Map<string, NodeTemplate>([
  [ChatBasicNode.id, ChatBasicNode],
  [IntentPlanNode.id, IntentPlanNode],
  [ResultNarrateNode.id, ResultNarrateNode]
]);

export const InMemoryNodeRegistry: NodeRegistry = {
  get(nodeId: string): NodeTemplate | null {
    return NODE_MAP.get(nodeId) ?? null;
  }
};
