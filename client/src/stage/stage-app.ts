import * as PIXI from 'pixi.js';

export type StageRef = {
  app: PIXI.Application;
  root: PIXI.Container; // stable root
  camera: PIXI.Container; // transforms (position/scale)
  world: PIXI.Container; // holds world layers (grid/fog/tokens/effects)
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

  const camera = new PIXI.Container();
  camera.sortableChildren = true;
  root.addChild(camera);

  const world = new PIXI.Container();
  world.sortableChildren = true;
  camera.addChild(world);

  return {
    app,
    root,
    camera,
    world,
    dispose: () => {
      app.destroy(true, { children: true });
    }
  };
}
