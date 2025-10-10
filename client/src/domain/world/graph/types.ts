import type { FieldId, FieldKind, MapId } from '../types';

export type FieldGraphNode = {
  id: FieldId;
  name: string;
  kind: FieldKind;
  neighbors: FieldId[];
  // World-space position for minimap/stage projection
  pos: { x: number; y: number };
};

export type FieldGraphEdge = {
  from: FieldId;
  to: FieldId;
  type: 'normal' | 'door' | 'bridge' | 'hidden';
};

export type FieldGraph = {
  mapId: MapId;
  nodes: FieldGraphNode[];
  edges: FieldGraphEdge[];
  bounds: { width: number; height: number; padding: number };
};

