import type { FieldNode, MapNode, BackgroundImageSpec, MusicSpec } from './types';

export function resolveFieldBackground(map: MapNode, field: FieldNode): BackgroundImageSpec {
  return field.bg ?? map.bg;
}

export function resolveFieldMusic(map: MapNode, field: FieldNode): MusicSpec {
  return field.musicCue ?? map.music;
}

