export type EventBus<TEvents extends Record<string | number | symbol, unknown>> = {
  publish: <K extends keyof TEvents>(event: K, payload: TEvents[K]) => void;
  subscribe: <K extends keyof TEvents>(event: K, handler: (payload: TEvents[K]) => void) => () => void;
  clear: (event?: keyof TEvents) => void;
};

export function createEventBus<TEvents extends Record<string | number | symbol, unknown>>(): EventBus<TEvents> {
  type EventKey = keyof TEvents;
  type AnyHandler = (payload: TEvents[EventKey]) => void;
  const handlers = new Map<EventKey, Set<AnyHandler>>();

  const publish = <K extends EventKey>(event: K, payload: TEvents[K]) => {
    const listeners = handlers.get(event);
    if (!listeners || listeners.size === 0) return;
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.warn('[event-bus] handler error', { event, error });
      }
    });
  };

  const subscribe = <K extends EventKey>(event: K, handler: (payload: TEvents[K]) => void) => {
    const set = handlers.get(event) ?? new Set<AnyHandler>();
    if (!handlers.has(event)) {
      handlers.set(event, set);
    }
    set.add(handler as AnyHandler);
    return () => {
      const current = handlers.get(event);
      if (!current) return;
      current.delete(handler as AnyHandler);
      if (current.size === 0) {
        handlers.delete(event);
      }
    };
  };

  const clear = (event?: EventKey) => {
    if (typeof event === 'undefined') {
      handlers.clear();
      return;
    }
    handlers.delete(event);
  };

  return { publish, subscribe, clear };
}
