import type { NpcAction } from '../types';
import { getMemory } from '../memory/store';
import { retrieveTopFacts } from '../memory/retrieval';
import { classifyIntent } from './intent';
import { sketchPlan } from './plan';
import { extractActionsFromText } from './extract';
import { redactReply } from './redact';
import { requestAICommand } from '../../ai/ai-gateway';
import { buildSystemPrompt, SAFETY_PROMPT } from '../prompts';
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
  const intent = classifyIntent(input.text);
  const plan = sketchPlan(intent, facts[0]?.content);
  try { netBus.publish('npc:pipeline:stage', { npcId: input.npcId, stage: 'plan', ms: performance.now() - t0 }); } catch {}
  // Try LLM draft with cached, short prompt; fallback to rule-based
  let draft = '';
  try {
    const persona = { name: input.npcId, style: '간결하고 냉정한', goals: [], taboo: [] };
    const system = `${buildSystemPrompt(persona)}\n${SAFETY_PROMPT}`;
    const brief = `플레이어:${input.fromId} → ${input.text.slice(0, 120)}\n전략:${plan.join(' / ')}\n관련기억:${(facts[0]?.content||'없음').slice(0, 60)}`;
    const resp = await requestAICommand({ manager: 'smart', requestType: 'npc.reply', actorId: input.npcId, userInstruction: brief, sections: {}, persona: system, locale: 'ko', temperature: 0.3, maxTokens: 80, fallbackChatText: '' });
    draft = String(resp.body ?? '').trim();
  } catch {}
  if (!draft) {
    const polite = input.mode === 'request' ? '요청을 검토하겠다.' : intent === 'ask' ? '질문에 답하겠다.' : intent === 'greet' ? '반갑다.' : '알았다.';
    draft = input.text?.trim() ? `${polite} ${plan[0] ?? ''}`.trim() : '...';
  }
  try { netBus.publish('npc:pipeline:stage', { npcId: input.npcId, stage: 'draft', ms: performance.now() - t0 }); } catch {}
  const actions = extractActionsFromText(input.npcId, draft);
  try { netBus.publish('npc:pipeline:stage', { npcId: input.npcId, stage: 'extract', ms: performance.now() - t0 }); } catch {}
  const text = redactReply(draft);
  try { netBus.publish('npc:pipeline:stage', { npcId: input.npcId, stage: 'redact', ms: performance.now() - t0 }); } catch {}
  return { text, actions };
}
