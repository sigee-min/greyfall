import type { NpcAction } from '../types';
import { getMemory } from '../memory/store';
import { retrieveTopFacts } from '../memory/retrieval';
import { netBus } from '../../../bus/net-bus';

export type DialogueInput = { npcId: string; fromId: string; text: string; mode?: 'say' | 'ask' | 'request' };
export type DialogueOutput = { text: string; actions?: NpcAction[]; memoryOps?: unknown[] };

// Stub pipeline: future steps will be composed here
export async function runDialogue(input: DialogueInput): Promise<DialogueOutput> {
  const t0 = performance.now();
  try { netBus.publish('npc:pipeline:stage', { npcId: input.npcId, stage: 'start', ms: 0 }); } catch {}
  const mem = getMemory(input.npcId);
  const facts = retrieveTopFacts(mem, 3);
  try { netBus.publish('npc:pipeline:stage', { npcId: input.npcId, stage: 'retrieve', ms: performance.now() - t0 }); } catch {}
  // simple rule-based stub reply that mentions a fact if available
  const polite = input.mode === 'request' ? '요청을 검토하겠다.' : input.mode === 'ask' ? '질문에 답변하겠다.' : '알았다.';
  const fact = facts[0]?.content ? ` (기억: ${facts[0].content.slice(0, 24)})` : '';
  const reply = input.text?.trim() ? `${polite}${fact}` : '...';
  try { netBus.publish('npc:pipeline:stage', { npcId: input.npcId, stage: 'draft', ms: performance.now() - t0 }); } catch {}
  return { text: reply, actions: [] };
}
