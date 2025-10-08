import type { NodeTemplate } from '../types';
import { linkDirectives } from '../../spec/prompts';
import { validateEntityLink } from '../../validators/entity-link';

export const EntityLinkNode: NodeTemplate = {
  id: 'entity.link',
  doc: '자연어 지칭→액터 ID 매핑(JSON 한 줄)',
  prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
  options: { temperature: 0.3, maxTokens: 120, timeoutMs: 20000 },
  inputSpec: { directive: 'string' },
  validate: async (raw) => validateEntityLink(raw)
};

export function makeEntityLinkParams(locale: 'ko' | 'en' = 'ko'): { directive: string } {
  return { directive: linkDirectives(locale) };
}

