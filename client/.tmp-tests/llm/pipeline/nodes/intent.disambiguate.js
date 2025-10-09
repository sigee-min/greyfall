import { disambiguateDirectives } from '../../spec/prompts';
import { validateDisambiguate } from '../../validators/disambiguate';
export const IntentDisambiguateNode = {
    id: 'intent.disambiguate',
    doc: '모호한 의도 확인(JSON 한 줄)',
    prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
    options: { temperature: 0.3, maxTokens: 240, timeoutMs: 20000 },
    inputSpec: { directive: 'string' },
    validate: async (raw) => validateDisambiguate(raw)
};
export function makeIntentDisambiguateParams(locale = 'ko') {
    return { directive: disambiguateDirectives(locale) };
}
