declare module '@pixi/filter-kawase-blur' {
  import type { Filter } from 'pixi.js';

  export class KawaseBlurFilter extends Filter {
    constructor(blur?: number, quality?: number);
  }
}

declare module '@pixi/filter-noise' {
  import type { Filter } from 'pixi.js';

  export class NoiseFilter extends Filter {
    constructor(noise?: number, seed?: number);
    noise: number;
  }
}
