import { linkDirectives } from '../../spec/prompts';
import { validateEntityLink } from '../../validators/entity-link';
export const EntityLinkNode = {
    id: 'entity.link',
    doc: '자연어 지칭→액터 ID 매핑(JSON 한 줄)',
    prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
    options: { temperature: 0.3, maxTokens: 240, timeoutMs: 20000 },
    inputSpec: { directive: 'string' },
    validate: async (raw) => validateEntityLink(raw)
};
export function makeEntityLinkParams(locale = 'ko') {
    return { directive: linkDirectives(locale) };
}
