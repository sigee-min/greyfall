import { rulesExtractDirectives } from '../../spec/prompts';
import { validateRulesExtract } from '../../validators/rules-extract';
export const RulesExtractNode = {
    id: 'rules.extract',
    doc: '규칙 키 제안(JSON 한 줄)',
    prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
    options: { temperature: 0.2, maxTokens: 240, timeoutMs: 20000 },
    inputSpec: { directive: 'string' },
    validate: async (raw) => validateRulesExtract(raw)
};
export function makeRulesExtractParams(locale = 'ko') {
    return { directive: rulesExtractDirectives(locale) };
}
