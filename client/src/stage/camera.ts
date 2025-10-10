import * as PIXI from 'pixi.js';

export type CameraState = { x: number; y: number; scale: number; minScale: number; maxScale: number };

export function clampCamera(cam: CameraState, world: { width: number; height: number }, viewport: { width: number; height: number }): { x: number; y: number; scale: number } {
  const scale = Math.max(cam.minScale, Math.min(cam.maxScale, cam.scale));
  const halfW = viewport.width / (2 * scale);
  const halfH = viewport.height / (2 * scale);
  let cx = cam.x;
  let cy = cam.y;
  if (world.width <= halfW * 2) {
    cx = world.width / 2;
  } else {
    cx = Math.max(halfW, Math.min(world.width - halfW, cx));
  }
  if (world.height <= halfH * 2) {
    cy = world.height / 2;
  } else {
    cy = Math.max(halfH, Math.min(world.height - halfH, cy));
  }
  return { x: cx, y: cy, scale };
}

export function applyCamera(container: PIXI.Container, cam: CameraState, world: { width: number; height: number }, viewport: { width: number; height: number }): void {
  const clamped = clampCamera(cam, world, viewport);
  container.scale.set(clamped.scale);
  // Position so that (clamped.x, clamped.y) aligns to the center of viewport
  const px = viewport.width / 2 - clamped.x * clamped.scale;
  const py = viewport.height / 2 - clamped.y * clamped.scale;
  container.position.set(px, py);
}

export function rectForViewport(cam: CameraState, viewport: { width: number; height: number }): { width: number; height: number } {
  const scale = Math.max(cam.minScale, Math.min(cam.maxScale, cam.scale));
  return { width: viewport.width / scale, height: viewport.height / scale };
}

export function worldToScreen(container: PIXI.Container, worldPt: { x: number; y: number }): { x: number; y: number } {
  const p = new PIXI.Point(worldPt.x, worldPt.y);
  return container.toGlobal(p);
}

export function screenToWorld(container: PIXI.Container, screenPt: { x: number; y: number }): { x: number; y: number } {
  const p = new PIXI.Point(screenPt.x, screenPt.y);
  const local = container.toLocal(p);
  return { x: local.x, y: local.y };
}

