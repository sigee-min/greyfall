import type { NodeTemplate } from '../types';
import { briefDirectives } from '../../spec/prompts';
import { validateNarrate } from '../../validators/narrate';

export const SceneBriefNode: NodeTemplate = {
  id: 'scene.brief',
  doc: '장면/상황 1–3문장 요약',
  prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
  options: { temperature: 0.4, maxTokens: 320, timeoutMs: 20000 },
  inputSpec: { directive: 'string' },
  validate: async (raw) => validateNarrate(raw, { maxSentences: 3, maxChars: 240 })
};

export function makeSceneBriefParams(locale: 'ko' | 'en' = 'ko'): { directive: string } {
  return { directive: briefDirectives(locale) };
}
