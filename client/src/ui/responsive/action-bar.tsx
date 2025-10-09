import { cn } from '../../lib/utils';
import { useMemo } from 'react';

type Action = {
  key: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'default' | 'destructive';
  disabled?: boolean;
};

type Props = {
  left?: Action[];
  right?: Action[];
};

export function ActionBar({ left = [], right = [] }: Props) {
  const safeBottom = useMemo(() => (typeof window === 'undefined' ? 0 : 0), []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center"
      style={{ paddingBottom: safeBottom }}
    >
      <div className="pointer-events-auto mx-3 mb-3 flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/90 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="flex items-center gap-2">
          {left.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={a.disabled}
              className={cn(
                'rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] transition',
                a.variant === 'destructive'
                  ? 'border-destructive/70 text-destructive hover:bg-destructive/10'
                  : a.variant === 'primary'
                    ? 'border-primary bg-primary/90 text-primary-foreground hover:bg-primary'
                    : 'border-border text-foreground hover:border-primary/60',
                a.disabled ? 'opacity-50' : undefined
              )}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {right.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={a.disabled}
              className={cn(
                'rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] transition',
                a.variant === 'destructive'
                  ? 'border-destructive/70 text-destructive hover:bg-destructive/10'
                  : a.variant === 'primary'
                    ? 'border-primary bg-primary/90 text-primary-foreground hover:bg-primary'
                    : 'border-border text-foreground hover:border-primary/60',
                a.disabled ? 'opacity-50' : undefined
              )}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

