import type { NodeTemplate } from '../types';
import { validateNarrate } from '../../validators/narrate';

export const SessionSummarizeNode: NodeTemplate = {
  id: 'session.summarize',
  doc: '세션 저장용 2–3문장 요약',
  prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
  options: { temperature: 0.3, maxTokens: 180, timeoutMs: 20000 },
  inputSpec: { directive: 'string' },
  validate: async (raw) => validateNarrate(raw, { maxSentences: 3, maxChars: 280 })
};

