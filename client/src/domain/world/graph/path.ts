import type { FieldId } from '../types';
import type { FieldGraph } from './types';

export function computeConnectedComponents(g: FieldGraph): Array<FieldId[]> {
  const adj = buildAdj(g);
  const seen = new Set<string>();
  const comps: Array<FieldId[]> = [];
  for (const n of g.nodes) {
    if (seen.has(n.id)) continue;
    const comp: string[] = [];
    const stack = [n.id];
    seen.add(n.id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nb of adj.get(cur) || []) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    }
    comps.push(comp as FieldId[]);
  }
  return comps;
}

export function computeReachable(
  g: FieldGraph,
  start: FieldId,
  budget: number,
  costFn?: (a: FieldId, b: FieldId) => number
): Set<FieldId> {
  const adj = buildAdj(g);
  const dist = new Map<string, number>();
  const pq: Array<{ id: string; d: number }> = [];
  const push = (id: string, d: number) => { pq.push({ id, d }); pq.sort((a, b) => a.d - b.d); };
  const pop = () => pq.shift()!;

  const cf = costFn ?? (() => 1);
  dist.set(start, 0);
  push(start, 0);
  while (pq.length) {
    const { id, d } = pop();
    if (d > budget) continue;
    for (const nb of adj.get(id) || []) {
      const w = Math.max(0, cf(id as FieldId, nb as FieldId));
      const nd = d + w;
      if (nd > budget) continue;
      if (!dist.has(nb) || nd < (dist.get(nb) as number)) {
        dist.set(nb, nd); push(nb, nd);
      }
    }
  }
  return new Set(Array.from(dist.keys()) as FieldId[]);
}

export function shortestPath(
  g: FieldGraph,
  start: FieldId,
  goal: FieldId,
  costFn?: (a: FieldId, b: FieldId) => number
): FieldId[] {
  if (start === goal) return [start];
  const adj = buildAdj(g);
  const cf = costFn ?? (() => 1);
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const pq: Array<{ id: string; d: number }> = [];
  const push = (id: string, d: number) => { pq.push({ id, d }); pq.sort((a, b) => a.d - b.d); };
  const pop = () => pq.shift()!;

  dist.set(start, 0);
  prev.set(start, null);
  push(start, 0);

  while (pq.length) {
    const { id, d } = pop();
    if (id === goal) break;
    for (const nb of adj.get(id) || []) {
      const w = Math.max(0, cf(id as FieldId, nb as FieldId));
      const nd = d + w;
      if (!dist.has(nb) || nd < (dist.get(nb) as number)) {
        dist.set(nb, nd); prev.set(nb, id); push(nb, nd);
      }
    }
  }

  if (!prev.has(goal)) return [];
  const path: string[] = [];
  let cur: string | null | undefined = goal;
  while (cur) { path.push(cur); cur = prev.get(cur) ?? null; }
  path.reverse();
  return path as FieldId[];
}

function buildAdj(g: FieldGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of g.nodes) adj.set(n.id, []);
  for (const e of g.edges) {
    (adj.get(e.from) as string[]).push(e.to);
    (adj.get(e.to) as string[]).push(e.from);
  }
  for (const [k, v] of adj) adj.set(k, Array.from(new Set(v)));
  return adj;
}

