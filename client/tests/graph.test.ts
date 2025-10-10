import { WORLD_STATIC } from '../src/domain/world/data';
import { buildFieldGraph } from '../src/domain/world/graph/build';
import { layoutFieldGraph } from '../src/domain/world/graph/layout';
import { computeConnectedComponents, shortestPath } from '../src/domain/world/graph/path';

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

const WORLD_W = 4096;
const WORLD_H = 4096;

for (const map of WORLD_STATIC.maps) {
  const g0 = buildFieldGraph(map, { width: WORLD_W, height: WORLD_H, padding: 128 });
  assert(g0.nodes.length === map.fields.length, `nodes count mismatch for map ${map.id}`);
  const g = layoutFieldGraph(g0, { width: WORLD_W, height: WORLD_H, padding: 128, startId: map.entryFieldId });

  // Layout bounds
  for (const n of g.nodes) {
    assert(n.pos.x >= 0 && n.pos.x <= WORLD_W, `node ${n.id} x out of bounds`);
    assert(n.pos.y >= 0 && n.pos.y <= WORLD_H, `node ${n.id} y out of bounds`);
  }

  // Connectivity sanity
  const comps = computeConnectedComponents(g);
  assert(comps.length >= 1, `components missing for ${map.id}`);

  // Neighbor path existence
  for (const f of map.fields) {
    for (const nb of f.neighbors) {
      const path = shortestPath(g, f.id, nb);
      assert(path.length >= 2, `no path between neighbor ${f.id} -> ${nb} in ${map.id}`);
    }
  }
}

console.log('graph.test.ts passed');

