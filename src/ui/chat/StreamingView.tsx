import React, { useCallback, useMemo, useState } from 'react';
import { useLlmStream } from './use-llm-stream';

// NOTE: debugSystemPrompt is intended for sandbox/debug usage only.
// In production, system/persona prompts should be constructed by the pipeline (context.build node).
// @deprecated In production flows, do not pass this prop.
type Props = {
  manager?: 'fast' | 'smart';
  debugSystemPrompt?: string; // deprecated in production
  className?: string;
};

export function StreamingView({ manager = 'fast', debugSystemPrompt, className }: Props) {
  const [userInput, setUserInput] = useState('');
  const { state, start, abort, reset, hardReset } = useLlmStream(debugSystemPrompt);

  const canStart = state.phase === 'idle' || state.phase === 'done' || state.phase === 'error' || state.phase === 'aborted';
  const canAbort = state.phase === 'generating';

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    void start(userInput, { manager, maxTokens: 1024, temperature: 0 });
  }, [userInput, start, manager]);

  const header = useMemo(() => (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-semibold">Stream</span>
      <span>•</span>
      <span>{state.phase}</span>
      {state.error && <span className="text-destructive">{state.error}</span>}
    </div>
  ), [state.phase, state.error]);

  return (
    <section className={className}>
      {header}
      <div className="mt-2 rounded-md border border-border/60 bg-card/70 p-3 text-sm">
        <div className="min-h-[120px] whitespace-pre-wrap">
          {state.tokens.length > 0 ? state.tokens.join('') : state.fullText}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
        <textarea
          className="h-20 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="메시지를 입력하세요"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          spellCheck={false}
        />
        <div className="flex items-center gap-2">
          <button type="submit" disabled={!canStart} className="rounded-md border border-primary bg-primary/90 px-3 py-2 text-xs font-semibold tracking-wide text-primary-foreground disabled:opacity-60">시작</button>
          <button type="button" disabled={!canAbort} onClick={abort} className="rounded-md border px-3 py-2 text-xs font-semibold tracking-wide disabled:opacity-60">중단</button>
          <button type="button" onClick={reset} className="rounded-md border px-3 py-2 text-xs font-semibold tracking-wide">초기화</button>
          <button type="button" onClick={hardReset} className="rounded-md border px-3 py-2 text-xs font-semibold tracking-wide">엔진재시작</button>
        </div>
      </form>
    </section>
  );
}
