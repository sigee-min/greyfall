import { summarizeDirectives } from '../../spec/prompts';
import { validateBullets } from '../../validators/bullets';
export const TurnSummarizeNode = {
    id: 'turn.summarize',
    doc: '최근 N턴 핵심 bullet 2–3개(JSON 한 줄)',
    prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
    options: { temperature: 0.3, maxTokens: 240, timeoutMs: 20000 },
    inputSpec: { directive: 'string' },
    validate: async (raw) => validateBullets(raw, 48)
};
export function makeTurnSummarizeParams(locale = 'ko') {
    return { directive: summarizeDirectives(locale) };
}
