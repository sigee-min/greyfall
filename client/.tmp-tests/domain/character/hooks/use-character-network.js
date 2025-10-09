import { useCallback } from 'react';
import { CHARACTER_LOADOUT_OBJECT_ID } from '../../net-objects/character-ids';
import { useCharacterAssembly } from './use-character-assembly';
import { createLobbyLoadoutFromSummary } from '../character-sync';
export function useCharacterNetwork({ localParticipantId = null, publish }) {
    const { getSummary } = useCharacterAssembly();
    const sendLoadout = useCallback(() => {
        if (!localParticipantId)
            return false;
        const summary = getSummary();
        const payload = createLobbyLoadoutFromSummary(localParticipantId, summary);
        if (!payload)
            return false;
        publish('character:set', { playerId: localParticipantId, loadout: payload }, 'character:set');
        return true;
    }, [getSummary, localParticipantId, publish]);
    const sendReset = useCallback(() => {
        if (!localParticipantId)
            return false;
        publish('character:reset', { playerId: localParticipantId }, 'character:reset');
        return true;
    }, [localParticipantId, publish]);
    const requestLoadouts = useCallback(() => {
        return publish('object:request', { id: CHARACTER_LOADOUT_OBJECT_ID }, 'character:request');
    }, [publish]);
    return { sendLoadout, sendReset, requestLoadouts };
}
