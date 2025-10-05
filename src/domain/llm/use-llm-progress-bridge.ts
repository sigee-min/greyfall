import { useEffect, useMemo, useRef, useState } from 'react';
import type { RegisterLobbyHandler, PublishLobbyMessage } from '../chat/use-chat-net-sync';

export type LlmProgressPayload = {
  ready?: boolean;
  progress?: number | null;
  status?: string | null;
  error?: string | null;
};

export function useBroadcastLlmProgress(options: {
  enabled: boolean;
  payload: LlmProgressPayload;
  publish: PublishLobbyMessage;
  throttleMs?: number;
}) {
  const { enabled, payload, publish, throttleMs = 300 } = options;
  const lastSentRef = useRef<LlmProgressPayload>({});
  const lastAtRef = useRef(0);

  // Only emit when values actually change (shallow compare) and throttle bursts
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();

    const changed = hasDiff(lastSentRef.current, payload);
    const elapsed = now - lastAtRef.current;
    const mustSend = changed && (elapsed >= throttleMs || Boolean(payload.ready) || Boolean(payload.error));
    if (!mustSend) return;

    const ok = publish('llm:progress', normalizePayload(payload), 'llm-progress');
    if (ok) {
      lastSentRef.current = { ...payload };
      lastAtRef.current = now;
    }
  }, [enabled, payload, publish, throttleMs]);
}

export function useReceiveLlmProgress(options: { register: RegisterLobbyHandler }) {
  const { register } = options;
  const [state, setState] = useState<Required<LlmProgressPayload>>({
    ready: false,
    progress: null,
    status: null,
    error: null
  });

  useEffect(() => {
    return register('llm:progress', (message) => {
      const body = message.body;
      setState((prev) => ({
        ready: body.ready ?? prev.ready,
        progress: typeof body.progress === 'number' || body.progress === null ? body.progress : prev.progress,
        status: typeof body.status === 'string' || body.status === null ? body.status : prev.status,
        error: typeof body.error === 'string' || body.error === null ? body.error : prev.error
      }));
    });
  }, [register]);

  return useMemo(() => state, [state]);
}

function hasDiff(a: LlmProgressPayload, b: LlmProgressPayload) {
  return a.ready !== b.ready || a.progress !== b.progress || a.status !== b.status || a.error !== b.error;
}

function normalizePayload(p: LlmProgressPayload): LlmProgressPayload {
  const out: LlmProgressPayload = {};
  if ('ready' in p) out.ready = p.ready ?? false;
  if ('progress' in p) out.progress = p.progress ?? null;
  if ('status' in p) out.status = p.status ?? null;
  if ('error' in p) out.error = p.error ?? null;
  return out;
}

