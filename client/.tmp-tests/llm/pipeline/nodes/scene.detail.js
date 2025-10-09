import { detailDirectives } from '../../spec/prompts';
import { validateNarrate } from '../../validators/narrate';
export const SceneDetailNode = {
    id: 'scene.detail',
    doc: '요소 1–2문장 확장',
    prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
    options: { temperature: 0.4, maxTokens: 280, timeoutMs: 20000 },
    inputSpec: { directive: 'string' },
    validate: async (raw) => validateNarrate(raw, { maxSentences: 2, maxChars: 180 })
};
export function makeSceneDetailParams(locale = 'ko') {
    return { directive: detailDirectives(locale) };
}
