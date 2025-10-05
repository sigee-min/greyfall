const MULBERRY32 = 0x6d2b79f5;

export type Rng = () => number;

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

export function createRng(seed: string): Rng {
  let state = hashSeed(seed) || MULBERRY32;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollDie(rng: Rng, sides: number): number {
  return Math.floor(rng() * sides) + 1;
}

export function rollD20(rng: Rng, modifier = 0): { total: number; natural: number } {
  const natural = rollDie(rng, 20);
  return { natural, total: natural + modifier };
}

export function checkSuccess(target: number, total: number) {
  if (total >= target) {
    return 'success' as const;
  }
  if (target - total <= 3) {
    return 'mixed' as const;
  }
  return 'fail' as const;
}
