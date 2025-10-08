import { useEffect, useState } from 'react';
import { netBus } from '../../bus/net-bus';
import { useI18n } from '../../i18n';

type NetworkMonitorDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function NetworkMonitorDialog({ open, onClose }: NetworkMonitorDialogProps) {
  const { t } = useI18n();
  const [acks, setAcks] = useState<{ scheduled: number; resolved: number; fallback: number }>(() => ({ scheduled: 0, resolved: 0, fallback: 0 }));
  const [queues, setQueues] = useState<{ enqueued: number; flushed: number; maxSize: number }>({ enqueued: 0, flushed: 0, maxSize: 0 });

  useEffect(() => {
    if (!open) return;
    const unsub1 = netBus.subscribe('net:ack:scheduled', () => setAcks((s) => ({ ...s, scheduled: s.scheduled + 1 })));
    const unsub2 = netBus.subscribe('net:ack:resolved', () => setAcks((s) => ({ ...s, resolved: s.resolved + 1 })));
    const unsub3 = netBus.subscribe('net:ack:fallback', () => setAcks((s) => ({ ...s, fallback: s.fallback + 1 })));
    const unsub4 = netBus.subscribe('net:queue:enqueue', (e) => setQueues((q) => ({ ...q, enqueued: q.enqueued + 1, maxSize: Math.max(q.maxSize, e.size) })));
    const unsub5 = netBus.subscribe('net:queue:flush', () => setQueues((q) => ({ ...q, flushed: q.flushed + 1 })));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [open]);

  if (!open) return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 px-6 py-10 backdrop-blur">
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border/60 bg-background/95 p-6 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary/70">{t('netmon.subtitle')}</p>
            <h2 className="text-2xl font-semibold">{t('netmon.title')}</h2>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border/60 bg-background/70 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('netmon.ack')}</p>
              <p>scheduled: {acks.scheduled}</p>
              <p>resolved: {acks.resolved}</p>
              <p>fallbacks: {acks.fallback}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/70 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('netmon.queue')}</p>
              <p>enqueued: {queues.enqueued}</p>
              <p>flushed: {queues.flushed}</p>
              <p>max size: {queues.maxSize}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('netmon.note')}</p>
        </section>
      </div>
    </div>
  );
}

