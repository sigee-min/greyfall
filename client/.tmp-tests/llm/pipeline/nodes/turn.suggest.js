import { suggestDirectives } from '../../spec/prompts';
import { validateBullets } from '../../validators/bullets';
export const TurnSuggestNode = {
    id: 'turn.suggest',
    doc: '다음 전개 제안 2–3개(JSON 한 줄)',
    prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
    options: { temperature: 0.4, maxTokens: 240, timeoutMs: 20000 },
    inputSpec: { directive: 'string' },
    validate: async (raw) => validateBullets(raw, 28)
};
export function makeTurnSuggestParams(locale = 'ko') {
    return { directive: suggestDirectives(locale) };
}
