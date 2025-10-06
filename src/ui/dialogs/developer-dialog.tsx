import { useI18n } from '../../i18n';

type DeveloperDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function DeveloperDialog({ open, onClose }: DeveloperDialogProps) {
  if (!open) return null;
  const { t } = useI18n();

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-6 py-10 backdrop-blur">
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border/60 bg-background/95 p-6 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{t('dev.subtitle')}</p>
            <h2 className="text-2xl font-semibold">{t('dev.title')}</h2>
          </div>
          <button
            type="button"
            className="rounded-md border border-border bg-background/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </header>

        <section className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('dev.helloTitle')}</h3>
            <p>{t('dev.helloBody')}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('dev.stackTitle')}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t('dev.stack.rendering')}</li>
              <li>{t('dev.stack.state')}</li>
              <li>{t('dev.stack.rtc')}</li>
              <li>{t('dev.stack.ai')}</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('dev.contactTitle')}</h3>
            <p>{t('dev.contactBody', { email: 'minshigee@gmail.com' })}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
