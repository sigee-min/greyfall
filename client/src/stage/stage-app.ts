import * as PIXI from 'pixi.js';

export type StageRef = {
  app: PIXI.Application;
  root: PIXI.Container;
  dispose: () => void;
};

if (typeof window !== 'undefined') {
  PIXI.settings.RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);
}

export async function createStage(canvas: HTMLCanvasElement): Promise<StageRef> {
  const app = new PIXI.Application({
    view: canvas,
    antialias: true,
    backgroundAlpha: 0,
    autoDensity: true,
    resizeTo: canvas.parentElement ?? window
  });

  const root = new PIXI.Container();
  root.sortableChildren = true;
  app.stage.addChild(root);

  return {
    app,
    root,
    dispose: () => {
      app.destroy(true, { children: true });
    }
  };
}
