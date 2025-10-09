import { createRng, rollD20, checkSuccess } from './prng';
export function resolveSkillCheck(input) {
    const rng = createRng(input.seed);
    const roll = rollD20(rng, input.modifier);
    const outcome = checkSuccess(input.target, roll.total);
    const risk = pickRisk(outcome, rng);
    return {
        outcome,
        total: roll.total,
        natural: roll.natural,
        risk
    };
}
function pickRisk(outcome, rng) {
    const risks = outcome === 'success'
        ? ['time', 'resource']
        : outcome === 'mixed'
            ? ['noise', 'scar', 'time']
            : ['noise', 'scar'];
    const index = Math.floor(rng() * risks.length);
    return risks[index] ?? 'time';
}
