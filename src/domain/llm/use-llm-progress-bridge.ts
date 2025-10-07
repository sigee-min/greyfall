import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { RegisterLobbyHandler, PublishLobbyMessage } from '../chat/use-chat-net-sync';
import { subscribeProgress, getLastProgress } from '../../llm/progress-bus';

export type LlmProgressPayload = {
  ready?: boolean;
  progress?: number | null;
  status?: string | null;
  error?: string | null;
  history?: string[];
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
  const payloadRef = useRef<LlmProgressPayload>(payload);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  const tryBroadcast = useCallback((candidate: LlmProgressPayload) => {
    if (!enabled) return;
    const now = Date.now();
    const last = lastSentRef.current;
    const changed = hasDiff(last, candidate);
    const statusChanged = last.status !== candidate.status;
    const mustSend = changed && (now - lastAtRef.current >= throttleMs || Boolean(candidate.ready) || Boolean(candidate.error) || statusChanged);
    if (!mustSend) return;
    const ok = publish('llm:progress', normalizePayload(candidate), 'llm-progress');
    if (ok) {
      lastSentRef.current = { ...candidate };
      lastAtRef.current = now;
    }
  }, [enabled, publish, throttleMs]);

  // Only emit when values actually change (shallow compare) and throttle bursts,
  // but always send immediately on status/ready/error changes to avoid UI stuck.
  useEffect(() => {
    tryBroadcast(payload);
  }, [payload, tryBroadcast]);

  useEffect(() => {
    if (!enabled) return;
    // Replay last progress snapshot immediately for new guests, then subscribe for live updates
    const last = getLastProgress();
    if (last) {
      tryBroadcast({
        ...payloadRef.current,
        status: typeof last.text === 'string' ? last.text : payloadRef.current.status,
        progress: typeof last.progress === 'number' ? last.progress : payloadRef.current.progress
      });
    }
    const unsub = subscribeProgress((report) => {
      const current = payloadRef.current;
      const next: LlmProgressPayload = {
        ready: current.ready,
        progress: typeof report.progress === 'number' ? report.progress : current.progress,
        status: typeof report.text === 'string' ? report.text : current.status,
        error: current.error
      };
      tryBroadcast(next);
    });
    return () => unsub();
  }, [enabled, tryBroadcast]);
}

import { LLM_PROGRESS_OBJECT_ID } from '../net-objects/llm-progress-host';

export function useReceiveLlmProgress(options: { register: RegisterLobbyHandler }) {
  const { register } = options;
  const [state, setState] = useState<Required<Omit<LlmProgressPayload, 'history'>> & { history: string[] }>({
    ready: false,
    progress: null,
    status: null,
    error: null,
    history: []
  });

  useEffect(() => {
    const unsub1 = register('llm:progress', (message) => {
      const body = message.body;
      setState((prev) => ({
        ready: body.ready ?? prev.ready,
        progress: typeof body.progress === 'number' || body.progress === null ? body.progress : prev.progress,
        status: typeof body.status === 'string' || body.status === null ? body.status : prev.status,
        error: typeof body.error === 'string' || body.error === null ? body.error : prev.error,
        history: Array.isArray(body.history) ? body.history : prev.history
      }));
    });
    // Also accept a net-object snapshot for late joiners
    const unsub2 = register('object:replace', (message) => {
      const { id, value } = message.body as any;
      if (id !== LLM_PROGRESS_OBJECT_ID) return;
      const v = value as any;
      setState((prev) => ({
        ready: typeof v?.ready === 'boolean' ? v.ready : prev.ready,
        progress: typeof v?.progress === 'number' || v?.progress === null ? (v?.progress ?? null) : prev.progress,
        status: typeof v?.status === 'string' || v?.status === null ? (v?.status ?? null) : prev.status,
        error: typeof v?.error === 'string' || v?.error === null ? (v?.error ?? null) : prev.error,
        history: prev.history
      }));
    });
    const unsub3 = register('object:patch', (message) => {
      const { id, ops } = message.body as any;
      if (id !== LLM_PROGRESS_OBJECT_ID) return;
      if (!Array.isArray(ops)) return;
      setState((prev) => {
        let cur = prev;
        for (const op of ops) {
          if (!op || op.op !== 'merge') continue;
          const v = op.value || {};
          cur = {
            ready: typeof v.ready === 'boolean' ? v.ready : cur.ready,
            progress:
              typeof v.progress === 'number' || v.progress === null ? (v.progress ?? null) : cur.progress,
            status: typeof v.status === 'string' || v.status === null ? (v.status ?? null) : cur.status,
            error: typeof v.error === 'string' || v.error === null ? (v.error ?? null) : cur.error,
            history: cur.history
          } as any;
        }
        return cur;
      });
    });
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
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
