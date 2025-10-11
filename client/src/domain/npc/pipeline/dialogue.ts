import type { NpcAction } from '../types';

export type DialogueInput = { npcId: string; fromId: string; text: string; mode?: 'say' | 'ask' | 'request' };
export type DialogueOutput = { text: string; actions?: NpcAction[]; memoryOps?: unknown[] };

// Stub pipeline: future steps will be composed here
export async function runDialogue(input: DialogueInput): Promise<DialogueOutput> {
  const polite = input.mode === 'request' ? '요청을 검토하겠다.' : input.mode === 'ask' ? '질문에 답변하겠다.' : '알았다.';
  const reply = input.text?.trim() ? `${polite}` : '...';
  return { text: reply, actions: [] };
}

