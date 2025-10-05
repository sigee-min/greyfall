import { useMemo } from 'react';
import { createEventBus } from './create-event-bus';
import type { SceneKey } from '../types/scenes';
import type { SessionParticipant } from '../domain/session/types';
import type { SessionChatMessage } from '../domain/chat/types';

export type GameBusEvents = {
  'scene:change': { scene: SceneKey };
  'lobby:ready-state': { ready: boolean; participants: number };
  'lobby:participants': { participants: SessionParticipant[] };
  'lobby:chat': { entry: SessionChatMessage; self: boolean };
};

const gameBus = createEventBus<GameBusEvents>();

export function useGameBus() {
  return useMemo(() => gameBus, []);
}
