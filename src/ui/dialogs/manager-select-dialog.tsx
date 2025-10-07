import React from 'react';
import { useI18n } from '../../i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  // GPU 선택 시 호출
  onSelect: (manager: 'fast' | 'smart') => void;
  // 저사양(CPU) 선택 시 호출 (예: 'gemma3-1b')
  onSelectCpuModel?: (modelId: string) => void;
};

export function ManagerSelectDialog({ open, onClose, onSelect, onSelectCpuModel }: Props) {
  if (!open) return null;
  const { t } = useI18n();
  const [tab, setTab] = React.useState<'low' | 'high'>('high');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="hud-card w-[min(640px,92vw)] rounded-2xl border border-border/60 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent/80">{t('manager.subtitle')}</p>
            <h3 className="text-xl font-semibold text-foreground">{t('manager.title')}</h3>
          </div>
          <button
            type="button"
            className="hud-button rounded-md border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </div>
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-widest ${tab === 'low' ? 'bg-primary text-primary-foreground' : 'border border-border/60 text-muted-foreground'}`}
            onClick={() => setTab('low')}
          >
            저사양
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-widest ${tab === 'high' ? 'bg-primary text-primary-foreground' : 'border border-border/60 text-muted-foreground'}`}
            onClick={() => setTab('high')}
          >
            고사양
          </button>
        </div>

        {tab === 'low' ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2">
            <button
              type="button"
              className="hud-button group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/10"
              onClick={() => onSelectCpuModel?.('gemma3-1b')}
            >
              <span className="glow-primary mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/45 ring-offset-1 ring-offset-background shadow shadow-black/40 transition-transform duration-300 ease-out group-hover:rotate-6 group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path fill="currentColor" d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
                </svg>
              </span>
              <span>
                <p className="text-sm font-semibold text-foreground">Fast</p>
                <p className="mt-1 text-xs text-muted-foreground">저사양 — 경량</p>
              </span>
            </button>

            <button
              type="button"
              className="hud-button group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/10"
              onClick={() => onSelectCpuModel?.('granite-micro')}
            >
              <span className="glow-primary mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/45 ring-offset-1 ring-offset-background shadow shadow-black/40 transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path fill="currentColor" d="M12 2 19 6v6c0 5-3.5 9-7 10C8.5 21 5 17 5 12V6l7-4z"/>
                </svg>
              </span>
              <span>
                <p className="text-sm font-semibold text-foreground">Smart</p>
                <p className="mt-1 text-xs text-muted-foreground">저사양 — 향상형</p>
              </span>
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2">
            <button
              type="button"
              className="hud-button group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left opacity-60"
              disabled
              aria-disabled="true"
            >
              <span className="glow-primary mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/45 ring-offset-1 ring-offset-background shadow shadow-black/40 transition-transform duration-300 ease-out group-hover:rotate-6 group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path fill="currentColor" d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
                </svg>
              </span>
              <span>
                <p className="text-sm font-semibold text-foreground">{t('manager.fast')}</p>
                <p className="mt-1 text-xs text-muted-foreground">고사양 — {t('manager.unimplemented')}</p>
              </span>
            </button>

            <button
              type="button"
              className="hud-button group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left opacity-60"
              disabled
              aria-disabled="true"
            >
              <span className="glow-primary mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/45 ring-offset-1 ring-offset-background shadow shadow-black/40 transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path fill="currentColor" d="M12 2 19 6v6c0 5-3.5 9-7 10C8.5 21 5 17 5 12V6l7-4z"/>
                </svg>
              </span>
              <span>
                <p className="text-sm font-semibold text-foreground">{t('manager.smart')}</p>
                <p className="mt-1 text-xs text-muted-foreground">고사양 — {t('manager.unimplemented')}</p>
              </span>
            </button>
          </div>
        )}
        <div className="mt-5 rounded-xl border border-border/60 bg-background/60 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{t('manager.notesTitle', { highlight: t('manager.notesPre') })}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>{t('manager.requirements.https')}</li>
            <li>{t('manager.requirements.webgpu')}</li>
            <li>{t('manager.requirements.fast')}</li>
            <li>{t('manager.requirements.smart')}</li>
            <li>{t('manager.requirements.download')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
