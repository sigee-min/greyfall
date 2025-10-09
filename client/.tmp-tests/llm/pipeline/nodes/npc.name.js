import { npcNameDirectives } from '../../spec/prompts';
import { validateNames } from '../../validators/names';
export const NpcNameNode = {
    id: 'npc.name',
    doc: '이름 2–3개(JSON 한 줄)',
    prompt: { systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}', userTpl: '${userSuffix}' },
    options: { temperature: 0.5, maxTokens: 240, timeoutMs: 20000 },
    inputSpec: { directive: 'string' },
    validate: async (raw) => validateNames(raw)
};
export function makeNpcNameParams(locale = 'ko') {
    return { directive: npcNameDirectives(locale) };
}
