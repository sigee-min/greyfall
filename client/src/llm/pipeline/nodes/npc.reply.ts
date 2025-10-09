import type { NodeTemplate } from '../types';
import { npcReplyDirectives } from '../../spec/prompts';
import { validateNarrate } from '../../validators/narrate';

export const NpcReplyNode: NodeTemplate = {
  id: 'npc.reply',
  doc: 'NPC 1–2문장 답변 (톤/말투)',
  prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
  options: { temperature: 0.5, maxTokens: 240, timeoutMs: 20000 },
  inputSpec: { directive: 'string' },
  validate: async (raw) => validateNarrate(raw, { maxSentences: 2, maxChars: 160 })
};

export function makeNpcReplyParams(locale: 'ko' | 'en' = 'ko'): { directive: string } {
  return { directive: npcReplyDirectives(locale) };
}
