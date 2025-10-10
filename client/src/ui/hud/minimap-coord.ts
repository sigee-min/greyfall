export type Rect = { x: number; y: number; width: number; height: number };

export function projectToMinimap(
  worldPt: { x: number; y: number },
  world: { width: number; height: number },
  inner: Rect
): { x: number; y: number } {
  const nx = world.width > 0 ? worldPt.x / world.width : 0;
  const ny = world.height > 0 ? worldPt.y / world.height : 0;
  return {
    x: inner.x + nx * inner.width,
    y: inner.y + ny * inner.height
  };
}

export function rectToMinimap(
  worldRect: Rect,
  world: { width: number; height: number },
  inner: Rect
): Rect {
  const topLeft = projectToMinimap({ x: worldRect.x, y: worldRect.y }, world, inner);
  const bottomRight = projectToMinimap({ x: worldRect.x + worldRect.width, y: worldRect.y + worldRect.height }, world, inner);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: Math.max(1, bottomRight.x - topLeft.x),
    height: Math.max(1, bottomRight.y - topLeft.y)
  };
}

