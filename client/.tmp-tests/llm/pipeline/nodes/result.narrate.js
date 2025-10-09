import { narrateDirectives } from '../../spec/prompts';
import { validateNarrate } from '../../validators/narrate';
export const ResultNarrateNode = {
    id: 'result.narrate',
    doc: '결과 서술: Rolls/Effects 기반 1–3문장.',
    prompt: {
        systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}',
        userTpl: '${userSuffix}'
    },
    options: {
        temperature: 0.4,
        maxTokens: 320,
        timeoutMs: 20000
    },
    inputSpec: { directive: 'string' },
    validate: async (raw) => {
        const v = validateNarrate(raw, { maxSentences: 3, maxChars: 280 });
        if (!v.ok || !v.fixed)
            return { ok: false, error: v.error ?? 'invalid' };
        return { ok: true, fixed: v.fixed };
    }
};
export function makeNarrateParams(locale = 'ko') {
    return { directive: narrateDirectives(locale) };
}
