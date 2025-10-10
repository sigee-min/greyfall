import type { MapNode } from '../types';
import { buildFieldGraph, type BuildOptions } from './build';
import { layoutFieldGraph, type LayoutOptions } from './layout';
import type { FieldGraph } from './types';

const cache = new Map<string, FieldGraph>();

function signatureOf(map: MapNode): string {
  // Simple content signature: field count + sorted adjacency signature
  const parts: string[] = [];
  parts.push(map.id);
  parts.push(String(map.fields.length));
  for (const f of map.fields.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const neigh = (f.neighbors || []).slice().sort().join(',');
    parts.push(`${f.id}:${neigh}`);
  }
  return parts.join('|');
}

export type GraphCreateOptions = BuildOptions & LayoutOptions;

export function getGraph(map: MapNode, opts: GraphCreateOptions = {}): FieldGraph {
  const sig = signatureOf(map);
  const cached = cache.get(sig);
  if (cached) return cached;
  const g0 = buildFieldGraph(map, opts);
  const startId = map.entryFieldId;
  const g1 = layoutFieldGraph(g0, { ...opts, startId });
  cache.set(sig, g1);
  return g1;
}

export function clearGraphCache(): void { cache.clear(); }

