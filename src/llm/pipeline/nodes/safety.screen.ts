import type { NodeTemplate } from '../types';
import { safetyScreenDirectives } from '../../spec/prompts';
import { validateSafetyScreen } from '../../validators/safety-screen';

export const SafetyScreenNode: NodeTemplate = {
  id: 'safety.screen',
  doc: '민감/부적절/룰 위반 1차 스크리닝(JSON 한 줄)',
  prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
  options: { temperature: 0.2, maxTokens: 240, timeoutMs: 20000 },
  inputSpec: { directive: 'string' },
  validate: async (raw) => validateSafetyScreen(raw)
};

export function makeSafetyScreenParams(locale: 'ko' | 'en' = 'ko'): { directive: string } {
  return { directive: safetyScreenDirectives(locale) };
}
