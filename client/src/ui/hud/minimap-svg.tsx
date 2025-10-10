import React, { useMemo } from 'react';
import { WORLD_STATIC } from '../../domain/world/data';
import { getGraph } from '../../domain/world/graph/state';
import type { FieldGraph } from '../../domain/world/graph/types';
import { worldPositionsClient } from '../../domain/net-objects/world-positions-client';
import { FieldIcon } from '../icons/fields/FieldIcon';

type Props = {
  // CSS pixels (inner content box inside the minimap round-rect)
  cssWidth: number;
  cssHeight: number;
  // World-space dimensions
  world: { width: number; height: number };
  localParticipantId?: string | null;
  // Visual toggles
  showLabels?: boolean;
  onNodeHover?: (id: string | null) => void;
  onNodeClick?: (id: string, pos: { x: number; y: number }) => void;
  hoverNodeId?: string | null;
  onExitClick?: (dir: 'prev' | 'next') => void;
  exitPrevTitle?: string;
  exitNextTitle?: string;
};

export function MinimapSvg({ cssWidth, cssHeight, world, localParticipantId = null, showLabels = true, onNodeHover, onNodeClick, hoverNodeId = null, onExitClick, exitPrevTitle, exitNextTitle }: Props) {
  const { map, graph, themeTag } = useMemo(() => {
    const pos = localParticipantId ? worldPositionsClient.getFor(localParticipantId) : null;
    const mid = pos?.mapId ?? WORLD_STATIC.head;
    const map = WORLD_STATIC.maps.find((m) => m.id === mid) ?? WORLD_STATIC.maps[0];
    const g: FieldGraph = getGraph(map, { width: world.width, height: world.height, padding: Math.max(64, 64) });
    return { map, graph: g, themeTag: map.theme?.tag ?? 'default' };
  }, [localParticipantId, world.width, world.height]);

  // Stroke colors (could be theme-bound later)
  const { edgeColor, nodeRing, nodeFill, labelFill } = pickPalette(themeTag);

  return (
    <svg
      width={cssWidth}
      height={cssHeight}
      viewBox={`0 0 ${world.width} ${world.height}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Minimap Graph"
      role="img"
      style={{ display: 'block' }}
    >
      <defs>
        <marker id="mm-arrow" orient="auto" markerWidth="6" markerHeight="6" refX="5" refY="3">
          <path d="M0,0 L6,3 L0,6 Z" fill={edgeColor} />
        </marker>
        <filter id="mm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="edges" stroke={edgeColor} strokeOpacity={0.7} fill="none" vectorEffect="non-scaling-stroke">
        {graph.edges.map((e) => {
          const a = graph.nodes.find((n) => n.id === e.from)!;
          const b = graph.nodes.find((n) => n.id === e.to)!;
          return <line key={`${e.from}::${e.to}`} x1={a.pos.x} y1={a.pos.y} x2={b.pos.x} y2={b.pos.y} strokeWidth={1.25} />;
        })}
      </g>
      <g className="nodes">
        {graph.nodes.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.pos.x},${n.pos.y})`}
            role="button"
            tabIndex={0}
            aria-label={n.name}
            onMouseEnter={() => onNodeHover?.(n.id)}
            onMouseLeave={() => onNodeHover?.(null)}
            onClick={() => onNodeClick?.(n.id, n.pos)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onNodeClick?.(n.id, n.pos); e.preventDefault(); } }}
            style={{ cursor: 'pointer', pointerEvents: 'auto', filter: hoverNodeId === n.id ? 'url(#mm-glow)' : undefined }}
          >
            <FieldIcon kind={n.kind} r={5.5} fill={nodeFill} stroke={nodeRing} strokeWidth={1} />
          </g>
        ))}
      </g>
      {showLabels && cssWidth >= 240 && (
        <g className="labels" fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" fontSize={12} fill={labelFill}>
          {placeLabels(graph).map((l) => (
            <text key={`label:${l.id}`} x={l.x} y={l.y} dominantBaseline="middle">{l.text}</text>
          ))}
        </g>
      )}
      {/* Exit markers */}
      {map.prev && (
        <g role="button" aria-label="Prev map" onClick={() => onExitClick?.('prev')} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
          <title>{exitPrevTitle ? exitPrevTitle : `← ${map.prev}`}</title>
          <polygon points={`${8},${world.height/2} ${28},${world.height/2 - 14} ${28},${world.height/2 + 14}`} fill={edgeColor} />
        </g>
      )}
      {map.next && (
        <g role="button" aria-label="Next map" onClick={() => onExitClick?.('next')} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
          <title>{exitNextTitle ? exitNextTitle : `${map.next} →`}</title>
          <polygon points={`${world.width - 8},${world.height/2} ${world.width - 28},${world.height/2 - 14} ${world.width - 28},${world.height/2 + 14}`} fill={edgeColor} />
        </g>
      )}
    </svg>
  );
}

function pickPalette(tag: string): { edgeColor: string; nodeRing: string; nodeFill: string; labelFill: string } {
  switch (tag) {
    case 'dark-cyber-worn-teal':
      return { edgeColor: '#64748b', nodeRing: '#7dd3fc', nodeFill: '#0b1220', labelFill: '#e2e8f0' };
    default:
      return { edgeColor: '#90a4ae', nodeRing: '#a3e1ff', nodeFill: '#0f172a', labelFill: '#e2e8f0' };
  }
}

function placeLabels(graph: FieldGraph): Array<{ id: string; x: number; y: number; text: string }> {
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  const out: Array<{ id: string; x: number; y: number; text: string }> = [];
  const approxW = (text: string) => Math.max(8, text.length * 6 + 8);
  const approxH = 12;
  for (const n of graph.nodes) {
    const text = n.name.slice(0, 12);
    const w = approxW(text);
    const h = approxH;
    const candidates: Array<{ x: number; y: number }> = [
      { x: n.pos.x + 10, y: n.pos.y },
      { x: n.pos.x - (w + 10), y: n.pos.y },
      { x: n.pos.x, y: n.pos.y - (h + 6) },
      { x: n.pos.x, y: n.pos.y + (h + 6) }
    ];
    let placedOk = false;
    for (const c of candidates) {
      const rect = { x: c.x, y: c.y - h / 2, w, h };
      if (!intersectsAny(rect, placed)) {
        placed.push(rect); out.push({ id: n.id, x: c.x, y: c.y, text }); placedOk = true; break;
      }
    }
    if (!placedOk) {
      // skip label if no free spot
    }
  }
  return out;
}

function intersectsAny(a: { x: number; y: number; w: number; h: number }, list: Array<{ x: number; y: number; w: number; h: number }>): boolean {
  for (const b of list) {
    if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) return true;
  }
  return false;
}
