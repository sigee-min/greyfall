import { Fragment, useEffect, useRef } from 'react';
import { selectScene, selectResources, useGreyfallStore } from '../../store';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/utils';

type SettingsOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsOverlay({ open, onClose }: SettingsOverlayProps) {
  const { t } = useI18n();
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
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">{t('settings.subtitle')}</p>
            <h2 className="text-2xl font-semibold">{t('settings.title')}</h2>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            {t('settings.resume')}
          </button>
        </header>

        <section className="rounded-xl border border-border/60 bg-card/70 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">{t('settings.scene.info')}</h3>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">{t('settings.scene.id')}</p>
              <p className="text-base font-medium text-foreground">{scene.id ?? t('settings.scene.unassigned')}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">{t('settings.scene.ambient')}</p>
              <p className="text-base font-medium text-foreground">{scene.ambientLight.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">{t('settings.scene.fog')}</p>
              <p className="text-base font-medium text-foreground">{scene.fog.enabled ? t('common.enabled') : t('common.disabled')}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">{t('settings.scene.resources')}</p>
              <p className="text-base font-medium text-foreground">{t('resources.glow')} {resources.glow} / {t('resources.corruption')} {resources.corruption}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-card/50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">{t('settings.tokens.title')}</h3>
            {tokenEntries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('settings.tokens.empty')}</p>
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
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">{t('settings.clocks.title')}</h3>
            {scene.clocks.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('settings.clocks.empty')}</p>
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
