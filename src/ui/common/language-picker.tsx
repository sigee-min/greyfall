import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export type LanguageOption = { value: string; label: string; hint?: string };

export function LanguagePicker({
  label,
  description,
  value,
  onChange,
  options,
  disabled
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  options: LanguageOption[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(() => Math.max(0, options.findIndex((o) => o.value === value)));

  const current = useMemo(() => options.find((o) => o.value === value) ?? options[0], [options, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => (i + 1) % options.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => (i - 1 + options.length) % options.length); }
      else if (e.key === 'Enter') { e.preventDefault(); const opt = options[activeIndex]; if (opt) { onChange(opt.value); setOpen(false); buttonRef.current?.focus(); } }
    };
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, [open, activeIndex, options, onChange]);

  useEffect(() => {
    // Keep activeIndex aligned with current value when changed externally
    setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [value, options]);

  return (
    <div ref={rootRef} className={cn('space-y-3 rounded-xl border border-border/60 bg-card/70 p-4', disabled ? 'opacity-60' : undefined)}>
      <div className="flex items-start justify-between gap-3 text-sm">
        <div>
          <p className="font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            data-cursor="pointer"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={cn(
              'min-w-[8.5rem] rounded-md border border-border/60 bg-background/70 px-3 py-2 text-left text-xs transition hover:border-primary/70 hover:text-primary',
              open ? 'border-primary text-primary' : undefined
            )}
          >
            <span className="block text-foreground">{current.label}</span>
          </button>
          {open && (
            <div className="absolute right-0 z-50 mt-1 w-[min(240px,90vw)] overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-2xl">
              <ul role="listbox" className="max-h-[240px] overflow-auto p-1">
                {options.map((opt, idx) => {
                  const selected = opt.value === value;
                  const active = idx === activeIndex;
                  return (
                    <li key={opt.value} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                          active ? 'bg-primary/10 text-primary' : 'hover:bg-card/70',
                          selected ? 'ring-1 ring-primary/40' : undefined
                        )}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => { onChange(opt.value); setOpen(false); buttonRef.current?.focus(); }}
                      >
                        <span className="block text-foreground">{opt.label}</span>
                        {selected && <span className="text-[11px]">✓</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
