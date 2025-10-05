import type { LobbyParticipant } from '../../protocol';

export const PARTICIPANTS_OBJECT_ID = 'participants';

export type ParticipantsSnapshot = {
  list: LobbyParticipant[];
  max: number;
};

export function makeParticipantsSnapshot(list: LobbyParticipant[], max = 4): ParticipantsSnapshot {
  return { list, max };
}

export function isParticipantsSnapshot(value: unknown): value is ParticipantsSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.list)) return false;
  if (typeof v.max !== 'number') return false;
  return true;
}

