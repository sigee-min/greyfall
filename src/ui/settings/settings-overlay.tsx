import { Fragment, useEffect, useRef } from 'react';
import { selectScene, selectResources, useGreyfallStore } from '../../store';
import { cn } from '../../lib/utils';

type SettingsOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsOverlay({ open, onClose }: SettingsOverlayProps) {
  const scene = useGreyfallStore(selectScene);
  const resources = useGreyfallStore(selectResources);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previous?.focus?.();
    };
  }, [open]);

  if (!open) {
    return <Fragment />;
  }

  const tokenEntries = Object.values(scene.tokens);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-6 py-10 backdrop-blur"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-border/60 bg-background/95 p-6 shadow-2xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Operations Settings</p>
            <h2 className="text-2xl font-semibold">Scene &amp; Session Overview</h2>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            Resume
          </button>
        </header>

        <section className="rounded-xl border border-border/60 bg-card/70 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Scene Information</h3>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Scene ID</p>
              <p className="text-base font-medium text-foreground">{scene.id ?? 'unassigned'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Ambient Light</p>
              <p className="text-base font-medium text-foreground">{scene.ambientLight.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Fog of War</p>
              <p className="text-base font-medium text-foreground">{scene.fog.enabled ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Resources</p>
              <p className="text-base font-medium text-foreground">Glow {resources.glow} / Corruption {resources.corruption}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Active Tokens</h3>
            {tokenEntries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No tokens deployed.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {tokenEntries.map((token) => (
                  <li
                    key={token.id}
                    className={cn(
                      'rounded-md border border-border/60 bg-background/70 px-3 py-2',
                      token.status?.length ? 'shadow-inner shadow-primary/20' : undefined
                    )}
                  >
                    <p className="font-medium text-foreground">{token.label}</p>
                    <p className="text-xs text-muted-foreground">
                      ({token.position.x.toFixed(1)}, {token.position.y.toFixed(1)}){token.status?.length ? ` · ${token.status.join(', ')}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Mission Clocks</h3>
            {scene.clocks.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No objectives armed.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {scene.clocks.map((clock) => (
                  <li key={clock.id} className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
                    <p className="font-medium text-foreground">{clock.label}</p>
                    <p className="text-xs text-muted-foreground">{clock.value} / {clock.max}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
