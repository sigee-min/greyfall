import { WORLD_STATIC } from './data';
import type { MapNode, FieldNode } from './types';

export function getMap(mapId: string): MapNode | null {
  return WORLD_STATIC.maps.find((m) => m.id === mapId) ?? null;
}

export function getField(map: MapNode, fieldId: string): FieldNode | null {
  return map.fields.find((f) => f.id === fieldId) ?? null;
}

export function isNeighbor(map: MapNode, fromFieldId: string, toFieldId: string): boolean {
  const from = getField(map, fromFieldId);
  if (!from) return false;
  return from.neighbors.includes(toFieldId);
}

export function getEntryField(map: MapNode): FieldNode | null {
  return getField(map, map.entryFieldId);
}

