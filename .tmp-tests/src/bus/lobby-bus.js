import { useMemo, useRef } from 'react';
import { createEventBus } from './create-event-bus';
export function useLobbyBus() {
    const busRef = useRef(createEventBus());
    const bus = busRef.current;
    return useMemo(() => ({
        publish: (message) => {
            const kind = message.kind;
            bus.publish(kind, message);
            bus.publish('message:any', message);
        },
        subscribe: (kind, handler) => bus.subscribe(kind, handler),
        subscribeAll: (handler) => bus.subscribe('message:any', handler)
    }), [bus]);
}
