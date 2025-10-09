import { hazardTagDirectives } from '../../spec/prompts';
import { validateHazardTag } from '../../validators/hazard-tag';
export const SceneHazardTagNode = {
    id: 'scene.hazard.tag',
    doc: '장면 위험 태깅(JSON 한 줄)',
    prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
    options: { temperature: 0.3, maxTokens: 240, timeoutMs: 20000 },
    inputSpec: { directive: 'string' },
    validate: async (raw) => validateHazardTag(raw)
};
export function makeSceneHazardTagParams(locale = 'ko') {
    return { directive: hazardTagDirectives(locale) };
}
