import { useMemo } from 'react';
import { createEventBus } from './create-event-bus';
const globalBus = createEventBus();
export function useGlobalBus() {
    return useMemo(() => globalBus, []);
}
