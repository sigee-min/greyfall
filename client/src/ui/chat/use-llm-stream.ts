import { useCallback, useMemo, useRef, useState } from 'react';
import type { ChatOptions } from '../../llm/llm-engine';
import { ensureChatApiReady, generateChat, loadEngineByManager, resetEngine } from '../../llm/llm-engine';

export type StreamPhase = 'idle' | 'preparing' | 'generating' | 'done' | 'error' | 'aborted';

export type LlmStreamState = {
  phase: StreamPhase;
  tokens: string[];
  fullText: string;
  error: string | null;
};

export type StartOptions = Omit<ChatOptions, 'onToken' | 'signal'> & {
  manager?: 'fast' | 'smart';
  timeoutMs?: number;
};

export function useLlmStream(initialSystemPrompt?: string) {
  const [state, setState] = useState<LlmStreamState>({ phase: 'idle', tokens: [], fullText: '', error: null });
  const systemPromptRef = useRef<string | undefined>(initialSystemPrompt);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ phase: 'idle', tokens: [], fullText: '', error: null });
  }, []);

  const abort = useCallback(() => {
    if (state.phase === 'generating') {
      abortRef.current?.abort();
      setState((s) => ({ ...s, phase: 'aborted' }));
    }
  }, [state.phase]);

  const setSystemPrompt = useCallback((text?: string) => {
    systemPromptRef.current = text;
  }, []);

  const start = useCallback(async (prompt: string, opts?: StartOptions) => {
    const manager = opts?.manager ?? 'fast';
    const timeoutMs = Math.max(1_000, opts?.timeoutMs ?? 45_000);
    try {
      setState({ phase: 'preparing', tokens: [], fullText: '', error: null });
      await loadEngineByManager(manager);
      await ensureChatApiReady(manager, 30_000);

      const ctl = new AbortController();
      abortRef.current = ctl;
      setState({ phase: 'generating', tokens: [], fullText: '', error: null });

      const timer = setTimeout(() => ctl.abort('llm-stream-timeout'), timeoutMs);
      try {
        const full = await generateChat(prompt, {
          systemPrompt: systemPromptRef.current,
          temperature: opts?.temperature,
          topP: opts?.topP,
          maxTokens: opts?.maxTokens,
          signal: ctl.signal,
          onToken: (tok) => setState((s) => ({ ...s, tokens: [...s.tokens, tok], fullText: s.fullText + tok }))
        });
        setState((s) => ({ ...s, phase: 'done', fullText: full }));
      } finally {
        clearTimeout(timer);
        abortRef.current = null;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setState((s) => ({ ...s, phase: 'aborted' }));
      } else {
        setState((s) => ({ ...s, phase: 'error', error: String(err?.message || err) }));
      }
    }
  }, []);

  const hardReset = useCallback(() => {
    reset();
    try { resetEngine(); } catch {}
  }, [reset]);

  return useMemo(() => ({ state, start, abort, reset, hardReset, setSystemPrompt }), [state, start, abort, reset, hardReset, setSystemPrompt]);
}

