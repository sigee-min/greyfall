import { ChatBasicNode } from './nodes/chat.basic';
const NODE_MAP = new Map([[ChatBasicNode.id, ChatBasicNode]]);
export const InMemoryNodeRegistry = {
    get(nodeId) {
        return NODE_MAP.get(nodeId) ?? null;
    }
};
