import { useMemo, useRef } from 'react';
import { createEventBus } from './create-event-bus';
import type { LobbyMessage, LobbyMessageKind } from '../protocol';

export type LobbyBusEvents = {
  [K in LobbyMessageKind]: Extract<LobbyMessage, { kind: K }>;
} & {
  'message:any': LobbyMessage;
};

export type LobbyBus = {
  publish: (message: LobbyMessage) => void;
  subscribe: <K extends LobbyMessageKind>(kind: K, handler: (message: Extract<LobbyMessage, { kind: K }>) => void) => () => void;
  subscribeAll: (handler: (message: LobbyMessage) => void) => () => void;
};

export function useLobbyBus(): LobbyBus {
  const busRef = useRef(createEventBus<LobbyBusEvents>());
  const bus = busRef.current;

  return useMemo(
    () => ({
      publish: (message: LobbyMessage) => {
        const kind = message.kind;
        bus.publish(kind, message as LobbyBusEvents[typeof kind]);
        bus.publish('message:any', message);
      },
      subscribe: <K extends LobbyMessageKind>(
        kind: K,
        handler: (message: Extract<LobbyMessage, { kind: K }>) => void
      ) => bus.subscribe(kind, handler as unknown as (message: LobbyBusEvents[K]) => void),
      subscribeAll: (handler) => bus.subscribe('message:any', handler)
    }),
    [bus]
  );
}
