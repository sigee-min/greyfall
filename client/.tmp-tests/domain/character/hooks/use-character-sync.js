import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCharacterAssembly } from './use-character-assembly';
import { useCharacterLoadouts } from '../character-sync';
export function useLobbyCharacterSync(options = {}) {
    const { localParticipantId = null } = options;
    const { hydrateFromSnapshot, clear } = useCharacterAssembly();
    const snapshot = useCharacterLoadouts();
    const lastHydratedRef = useRef(null);
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
        }
        else {
            if (lastHydratedRef.current === localParticipantId) {
                clear();
                lastHydratedRef.current = null;
            }
        }
    }, [snapshot, localParticipantId, hydrateFromSnapshot, clear]);
    const hasAllBuilt = useCallback((participantIds) => {
        if (participantIds.length === 0)
            return false;
        for (const id of participantIds) {
            if (!snapshot.byId[id]?.built)
                return false;
        }
        return true;
    }, [snapshot.byId]);
    const localLoadout = useMemo(() => (localParticipantId ? snapshot.byId[localParticipantId] : undefined), [localParticipantId, snapshot.byId]);
    return {
        revision: snapshot.revision,
        loadouts: snapshot.entries,
        byId: snapshot.byId,
        localLoadout,
        hasAllBuilt
    };
}
