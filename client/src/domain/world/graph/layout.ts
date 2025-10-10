import type { FieldGraph } from './types';

export type LayoutOptions = {
  width?: number;
  height?: number;
  padding?: number;
  startId?: string; // preferred entry node id
};

// Simple layered layout: BFS from startId (or arbitrary first node),
// place levels horizontally, spread nodes in each level vertically.
export function layoutFieldGraph(g: FieldGraph, opts: LayoutOptions = {}): FieldGraph {
  const width = Math.max(1, Math.floor(opts.width ?? g.bounds.width));
  const height = Math.max(1, Math.floor(opts.height ?? g.bounds.height));
  const padding = Math.max(0, Math.floor(opts.padding ?? g.bounds.padding));
  if (g.nodes.length === 0) return { ...g, bounds: { width, height, padding } };

  const idToIndex = new Map(g.nodes.map((n, i) => [n.id, i] as const));
  const adj = new Map<string, string[]>();
  for (const n of g.nodes) adj.set(n.id, []);
  for (const e of g.edges) {
    (adj.get(e.from) as string[]).push(e.to);
    (adj.get(e.to) as string[]).push(e.from);
  }

  const start = opts.startId && idToIndex.has(opts.startId) ? opts.startId : g.nodes[0].id;
  const level = new Map<string, number>();
  const queue: string[] = [start];
  level.set(start, 0);
  for (let qi = 0; qi < queue.length; qi += 1) {
    const cur = queue[qi];
    for (const nb of adj.get(cur) || []) {
      if (level.has(nb)) continue;
      level.set(nb, (level.get(cur) || 0) + 1);
      queue.push(nb);
    }
  }
  // nodes with no level (disconnected) → append after max level
  const maxLevelInBfs = Math.max(...Array.from(level.values()));
  for (const n of g.nodes) if (!level.has(n.id)) level.set(n.id, maxLevelInBfs + 1);

  const maxLevel = Math.max(...Array.from(level.values()));
  const cols = maxLevel + 1;
  const innerW = Math.max(1, width - 2 * padding);
  const innerH = Math.max(1, height - 2 * padding);
  const colStep = cols > 1 ? innerW / (cols - 1) : innerW;

  const byLevel = new Map<number, string[]>();
  for (const [id, lv] of level) {
    const arr = byLevel.get(lv) || [];
    arr.push(id); byLevel.set(lv, arr);
  }
  for (const arr of byLevel.values()) arr.sort();

  for (const [id, lv] of level) {
    const nodesAt = byLevel.get(lv) as string[];
    const idx = nodesAt.indexOf(id);
    const rows = nodesAt.length;
    const rowStep = rows > 1 ? innerH / (rows - 1) : 0;
    const x = padding + lv * colStep;
    const y = padding + (rows > 1 ? idx * rowStep : innerH / 2);
    const n = g.nodes[idToIndex.get(id)!];
    n.pos.x = x; n.pos.y = y;
  }

  return { ...g, bounds: { width, height, padding } };
}

