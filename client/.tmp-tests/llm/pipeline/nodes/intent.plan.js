import { planDirectives } from '../../spec/prompts';
import { validatePlanOutput } from '../../validators/plan';
function localeFromCtx(ctx) {
    const raw = (ctx.scratch && typeof ctx.scratch === 'object' ? ctx.scratch.overrides : null);
    const loc = raw && typeof raw.locale === 'string' ? raw.locale : undefined;
    return loc === 'en' ? 'en' : 'ko';
}
export const IntentPlanNode = {
    id: 'intent.plan',
    doc: '의도 계획: 행동/검사/위험/대상만 선택(JSON 한 줄).',
    prompt: {
        systemTpl: '${persona}\n\n${systemSuffix}\n\n${directive}',
        userTpl: '${userSuffix}'
    },
    options: {
        temperature: 0.2,
        maxTokens: 240,
        timeoutMs: 20000
    },
    inputSpec: { directive: 'string' },
    validate: async (raw, _ctx) => {
        const v = validatePlanOutput(raw, { maxChecks: 2, maxHazards: 2, maxTargets: 2, allowItem: true });
        if (!v.ok || !v.fixed)
            return { ok: false, error: v.error ?? 'invalid' };
        // Emit back normalised JSON one-liner
        return { ok: true, fixed: JSON.stringify(v.fixed) };
    }
};
export function makePlanParams(ctx) {
    const locale = localeFromCtx(ctx);
    return { directive: planDirectives(locale) };
}
