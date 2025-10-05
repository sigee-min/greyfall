import { useMemo } from 'react';
import { createEventBus } from './create-event-bus';
const gameBus = createEventBus();
export function useGameBus() {
    return useMemo(() => gameBus, []);
}
