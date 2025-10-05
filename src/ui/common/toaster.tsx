import { useEffect, useState } from 'react';
import { useGlobalBus } from '../../bus/global-bus';

type Toast = { id: string; title?: string; message: string; status: 'info'|'success'|'warning'|'error'; until: number; icon?: string; duration: number; created: number };

function statusColors(status: Toast['status']) {
  switch (status) {
    case 'success': return 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300';
    case 'warning': return 'border-amber-500/60 bg-amber-500/10 text-amber-300';
    case 'error': return 'border-destructive/60 bg-destructive/10 text-destructive';
    default: return 'border-border/60 bg-background/80 text-foreground';
  }
}

export function Toaster() {
  const bus = useGlobalBus();
  const [list, setList] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubShow = bus.subscribe('toast:show', ({ title, message, status, durationMs, icon }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const duration = durationMs ?? 2500;
      const created = Date.now();
      const until = created + duration;
      setList((prev) => [...prev, { id, title, message, status: status ?? 'info', until, icon, duration, created }]);
    });
    const unsubClear = bus.subscribe('toast:clear', () => setList([]));
    const t = window.setInterval(() => {
      const now = Date.now();
      setList((prev) => prev.filter((x) => x.until > now));
    }, 250);
    return () => { unsubShow(); unsubClear(); window.clearInterval(t); };
  }, [bus]);

  return (
    <div className="pointer-events-none absolute right-6 top-6 z-[60] flex w-[360px] flex-col gap-3">
      {list.map((t) => {
        const pct = Math.max(0, Math.min(1, (t.until - Date.now()) / t.duration));
        return (
          <div key={t.id} className={`pointer-events-auto overflow-hidden rounded-md border px-3 py-2 text-sm shadow ${statusColors(t.status)}`}>
            <div className="flex items-start gap-2">
              {t.icon && <div className="text-lg leading-none">{t.icon}</div>}
              <div className="flex-1">
                {t.title && <div className="text-xs font-semibold uppercase tracking-[0.3em] opacity-80">{t.title}</div>}
                <div className="mt-1 whitespace-pre-wrap text-[13px]">{t.message}</div>
              </div>
            </div>
            <div className="mt-2 h-1 w-full rounded bg-white/10">
              <div className="h-1 rounded bg-white/30" style={{ width: `${pct * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
