import React from 'react';

type Props = {
  displayText: string;
  error?: string | null;
  progressPercent: number | null;
  history?: string[];
};

export function LlmProgressOverlay({ displayText, error, progressPercent }: Props) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 w-[min(360px,92vw)] -translate-x-1/2 rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-xs text-muted-foreground shadow-lg backdrop-blur text-center">
      <p className="font-semibold text-foreground">{displayText}</p>
      {error ? (
        <p className="mt-1 text-[11px] text-destructive">{error}</p>
      ) : (
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-border/50">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progressPercent ?? 0}%` }}
            />
          </div>
          <span className="min-w-[2.5rem] text-center text-[11px] tabular-nums">{progressPercent ?? 0}%</span>
        </div>
      )}
      {/* History hidden to avoid duplicate texts; keep single status line only */}
    </div>
  );
}
