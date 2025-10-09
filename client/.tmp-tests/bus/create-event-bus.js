export function createEventBus() {
    const handlers = new Map();
    const publish = (event, payload) => {
        const listeners = handlers.get(event);
        if (!listeners || listeners.size === 0)
            return;
        listeners.forEach((listener) => {
            try {
                listener(payload);
            }
            catch (error) {
                console.warn('[event-bus] handler error', { event, error });
            }
        });
    };
    const subscribe = (event, handler) => {
        const set = handlers.get(event) ?? new Set();
        if (!handlers.has(event)) {
            handlers.set(event, set);
        }
        set.add(handler);
        return () => {
            const current = handlers.get(event);
            if (!current)
                return;
            current.delete(handler);
            if (current.size === 0) {
                handlers.delete(event);
            }
        };
    };
    const clear = (event) => {
        if (typeof event === 'undefined') {
            handlers.clear();
            return;
        }
        handlers.delete(event);
    };
    return { publish, subscribe, clear };
}
