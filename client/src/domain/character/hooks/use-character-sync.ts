import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CharacterLoadout } from '../types';
import { useCharacterAssembly } from './use-character-assembly';
import { useCharacterLoadouts } from '../character-sync';

export type UseLobbyCharacterSyncOptions = {
  localParticipantId?: string | null;
};

export type UseLobbyCharacterSyncResult = {
  revision: number;
  loadouts: CharacterLoadout[];
  byId: Record<string, CharacterLoadout>;
  localLoadout?: CharacterLoadout;
  hasAllBuilt: (participantIds: string[]) => boolean;
};

export function useLobbyCharacterSync(
  options: UseLobbyCharacterSyncOptions = {}
): UseLobbyCharacterSyncResult {
  const { localParticipantId = null } = options;
  const { hydrateFromSnapshot, clear } = useCharacterAssembly();
  const snapshot = useCharacterLoadouts();
  const lastHydratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!localParticipantId) {
      if (lastHydratedRef.current) {
        clear();
        lastHydratedRef.current = null;
      }
      return;
    }
    const loadout = snapshot.byId[localParticipantId];
    if (loadout) {
      hydrateFromSnapshot(loadout);
      lastHydratedRef.current = localParticipantId;
    } else {
      if (lastHydratedRef.current === localParticipantId) {
        clear();
        lastHydratedRef.current = null;
      }
    }
  }, [snapshot, localParticipantId, hydrateFromSnapshot, clear]);

  const hasAllBuilt = useCallback(
    (participantIds: string[]) => {
      if (participantIds.length === 0) return false;
      for (const id of participantIds) {
        if (!snapshot.byId[id]?.built) return false;
      }
      return true;
    },
    [snapshot.byId]
  );

  const localLoadout = useMemo(
    () => (localParticipantId ? snapshot.byId[localParticipantId] : undefined),
    [localParticipantId, snapshot.byId]
  );

  return {
    revision: snapshot.revision,
    loadouts: snapshot.entries,
    byId: snapshot.byId,
    localLoadout,
    hasAllBuilt
  };
}
