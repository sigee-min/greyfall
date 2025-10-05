import { useMemo } from 'react';
import { createEventBus } from './create-event-bus';
import type { SessionMode } from '../domain/session/types';

export type GlobalSessionState =
  | { mode: 'idle' }
  | { mode: SessionMode; code: string | null; participants: number };

export type GlobalBusEvents = {
  'error:show': { message: string; context?: string; cause?: unknown };
  'error:clear': undefined;
  'session:state': GlobalSessionState;
  'toast:show': { title?: string; message: string; status?: 'info' | 'success' | 'warning' | 'error'; durationMs?: number; icon?: string };
  'toast:clear': undefined;
};

const globalBus = createEventBus<GlobalBusEvents>();

export function useGlobalBus() {
  return useMemo(() => globalBus, []);
}
