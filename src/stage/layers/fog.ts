import * as PIXI from 'pixi.js';
import { KawaseBlurFilter } from '@pixi/filter-kawase-blur';
import { NoiseFilter } from '@pixi/filter-noise';
import type { FogState } from '../../store';

export type FogLayer = {
  container: PIXI.Container;
  overlay: PIXI.Sprite;
  mask: PIXI.Graphics;
};

export function createFogLayer(): FogLayer {
  const container = new PIXI.Container();
  const overlay = new PIXI.Sprite(PIXI.Texture.WHITE);
  overlay.tint = 0x020617;
  overlay.alpha = 0.82;
  overlay.width = 4096;
  overlay.height = 4096;

  const mask = new PIXI.Graphics();
  overlay.mask = mask;

  overlay.filters = [new KawaseBlurFilter(5, 3), new NoiseFilter(0.12)];

  container.addChild(overlay);
  container.addChild(mask);

  return { container, overlay, mask };
}

export function syncFog(layer: FogLayer, fog: FogState) {
  const { overlay, mask } = layer;
  overlay.visible = fog.enabled;

  mask.clear();

  if (!fog.enabled) {
    return;
  }

  mask.beginFill(0xffffff, 1);
  mask.drawRect(0, 0, overlay.width, overlay.height);

  mask.beginHole();
  fog.reveals.forEach((reveal) => {
    mask.drawCircle(reveal.position.x, reveal.position.y, reveal.radius);
  });
  mask.endHole();
  mask.endFill();
}
