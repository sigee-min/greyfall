import type { NodeTemplate } from '../types';
import { validateNarrate } from '../../validators/narrate';

export const RulesNarrateNode: NodeTemplate = {
  id: 'rules.narrate',
  doc: '규칙 발췌/결과 1–2문장 설명',
  prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
  options: { temperature: 0.3, maxTokens: 140, timeoutMs: 20000 },
  inputSpec: { directive: 'string' },
  validate: async (raw) => {
    const v = validateNarrate(raw, { maxSentences: 2, maxChars: 180 });
    return v.ok && v.fixed ? { ok: true, fixed: v.fixed } : { ok: false, error: v.error ?? 'invalid' };
  }
};

