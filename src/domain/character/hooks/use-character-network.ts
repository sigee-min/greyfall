import { useCallback } from 'react';
import type { Publish } from './use-character-assembly';
import { CHARACTER_LOADOUT_OBJECT_ID } from '../../net-objects/character-ids';
import { useCharacterAssembly } from './use-character-assembly';
import { createLobbyLoadoutFromSummary } from '../character-sync';

type UseCharacterNetworkOptions = {
  localParticipantId?: string | null;
  publish: Publish;
};

export type UseCharacterNetworkResult = {
  sendLoadout: () => boolean;
  sendReset: () => boolean;
  requestLoadouts: () => boolean;
};

export function useCharacterNetwork({ localParticipantId = null, publish }: UseCharacterNetworkOptions): UseCharacterNetworkResult {
  const { getSummary } = useCharacterAssembly();

  const sendLoadout = useCallback(() => {
    if (!localParticipantId) return false;
    const summary = getSummary();
    const payload = createLobbyLoadoutFromSummary(localParticipantId, summary);
    if (!payload) return false;
    publish('character:set', { playerId: localParticipantId, loadout: payload }, 'character:set');
    return true;
  }, [getSummary, localParticipantId, publish]);

  const sendReset = useCallback(() => {
    if (!localParticipantId) return false;
    publish('character:reset', { playerId: localParticipantId }, 'character:reset');
    return true;
  }, [localParticipantId, publish]);

  const requestLoadouts = useCallback(() => {
    return publish('object:request', { id: CHARACTER_LOADOUT_OBJECT_ID }, 'character:request');
  }, [publish]);

  return { sendLoadout, sendReset, requestLoadouts };
}
