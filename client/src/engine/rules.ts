import { createRng, rollD20, checkSuccess } from './prng';

export type ClockImpact = 'time' | 'noise' | 'scar' | 'resource';

export type ResolutionInput = {
  target: number;
  modifier: number;
  seed: string;
};

export type ResolutionResult = {
  outcome: 'success' | 'mixed' | 'fail';
  total: number;
  natural: number;
  risk: ClockImpact;
};

export function resolveSkillCheck(input: ResolutionInput): ResolutionResult {
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

function pickRisk(outcome: ResolutionResult['outcome'], rng: () => number): ClockImpact {
  const risks: ClockImpact[] = outcome === 'success'
    ? ['time', 'resource']
    : outcome === 'mixed'
      ? ['noise', 'scar', 'time']
      : ['noise', 'scar'];
  const index = Math.floor(rng() * risks.length);
  return risks[index] ?? 'time';
}
