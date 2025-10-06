import { selectLog, useGreyfallStore } from '../../store';
import { useI18n } from '../../i18n';

export function ChatDock() {
  const log = useGreyfallStore(selectLog);
  const { t } = useI18n();

  return (
    <section className="flex h-56 flex-col overflow-hidden rounded-xl border border-border bg-card/50">
      <header className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">{t('chatdock.title')}</h2>
      </header>
      <div className="scrollbar-lobby flex-1 space-y-3 overflow-auto px-4 py-3 text-sm">
        {log.length === 0 ? (
          <p className="text-muted-foreground">{t('chatdock.empty')}</p>
        ) : (
          log.map((entry) => (
            <article key={entry.id} className="rounded-md border border-border/40 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleTimeString()}</p>
              <p>{entry.body}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
