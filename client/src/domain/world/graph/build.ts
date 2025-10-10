import type { MapNode, FieldNode } from '../types';
import type { FieldGraph, FieldGraphEdge, FieldGraphNode } from './types';

export type BuildOptions = {
  width?: number;
  height?: number;
  padding?: number;
};

export function buildFieldGraph(map: MapNode, opts: BuildOptions = {}): FieldGraph {
  const width = Math.max(1, Math.floor(opts.width ?? 4096));
  const height = Math.max(1, Math.floor(opts.height ?? 4096));
  const padding = Math.max(0, Math.floor(opts.padding ?? 128));

  const idToNode = new Map<string, FieldGraphNode>();
  const edges: FieldGraphEdge[] = [];

  for (const f of map.fields) {
    idToNode.set(f.id, {
      id: f.id,
      name: f.name,
      kind: f.kind,
      neighbors: Array.from(new Set(f.neighbors || [])),
      pos: { x: 0, y: 0 }
    });
  }

  // Build undirected edges (dedupe by id pair)
  const seen = new Set<string>();
  const hasField = (id: string) => idToNode.has(id);
  const pairs: Array<[FieldNode, string]> = [];
  for (const f of map.fields) {
    for (const n of f.neighbors || []) pairs.push([f, n]);
  }
  for (const [a, b] of pairs) {
    if (!hasField(a.id) || !hasField(b)) continue;
    const key = a.id < b ? `${a.id}::${b}` : `${b}::${a.id}`;
    if (seen.has(key)) continue; seen.add(key);
    edges.push({ from: a.id, to: b, type: 'normal' });
  }

  return {
    mapId: map.id,
    nodes: Array.from(idToNode.values()),
    edges,
    bounds: { width, height, padding }
  };
}

