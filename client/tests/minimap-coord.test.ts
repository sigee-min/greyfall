import { projectToMinimap, rectToMinimap } from '../src/ui/hud/minimap-coord';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

const world = { width: 4096, height: 4096 };
const inner = { x: 8, y: 8, width: 240, height: 240 };

// Corners map to corners
const tl = projectToMinimap({ x: 0, y: 0 }, world, inner);
assert(Math.abs(tl.x - inner.x) < 1e-6 && Math.abs(tl.y - inner.y) < 1e-6, 'top-left mapping failed');

const br = projectToMinimap({ x: world.width, y: world.height }, world, inner);
assert(Math.abs(br.x - (inner.x + inner.width)) < 1e-6 && Math.abs(br.y - (inner.y + inner.height)) < 1e-6, 'bottom-right mapping failed');

// Viewport rectangle mapping
const wrect = { x: 2048 - 100, y: 2048 - 120, width: 200, height: 240 };
const mrect = rectToMinimap(wrect, world, inner);
assert(mrect.width > 0 && mrect.height > 0, 'minimap rect mapping invalid');

console.log('minimap-coord.test.ts passed');

