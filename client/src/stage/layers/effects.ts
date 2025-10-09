import * as PIXI from 'pixi.js';

export function createEffectsLayer(): PIXI.Container {
  const container = new PIXI.Container();
  container.sortableChildren = true;
  return container;
}

export function showPulse(container: PIXI.Container, at: { x: number; y: number }) {
  const graphic = new PIXI.Graphics();
  graphic.beginFill(0xf97316, 0.4);
  graphic.drawCircle(0, 0, 12);
  graphic.endFill();
  graphic.x = at.x;
  graphic.y = at.y;
  graphic.alpha = 0.4;
  container.addChild(graphic);

  const ticker = PIXI.Ticker.shared;
  const start = performance.now();

  const tick = () => {
    const elapsed = performance.now() - start;
    graphic.scale.set(1 + elapsed / 300);
    graphic.alpha = Math.max(0, 0.4 - elapsed / 400);
    if (elapsed > 400) {
      ticker.remove(tick);
      graphic.destroy();
    }
  };

  ticker.add(tick);
}
