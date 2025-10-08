import type { NodeTemplate } from '../types';
import { disambiguateDirectives } from '../../spec/prompts';
import { validateDisambiguate } from '../../validators/disambiguate';

export const IntentDisambiguateNode: NodeTemplate = {
  id: 'intent.disambiguate',
  doc: '모호한 의도 확인(JSON 한 줄)',
  prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
  options: { temperature: 0.3, maxTokens: 120, timeoutMs: 20000 },
  inputSpec: { directive: 'string' },
  validate: async (raw) => validateDisambiguate(raw)
};

export function makeIntentDisambiguateParams(locale: 'ko' | 'en' = 'ko'): { directive: string } {
  return { directive: disambiguateDirectives(locale) };
}

