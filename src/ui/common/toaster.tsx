import { useEffect, useState } from 'react';
import { useGlobalBus } from '../../bus/global-bus';

type Toast = { id: string; title?: string; message: string; status: 'info'|'success'|'warning'|'error'; until: number };

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
    const unsubShow = bus.subscribe('toast:show', ({ title, message, status, durationMs }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const until = Date.now() + (durationMs ?? 2500);
      setList((prev) => [...prev, { id, title, message, status: status ?? 'info', until }]);
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
      {list.map((t) => (
        <div key={t.id} className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow ${statusColors(t.status)}`}>
          {t.title && <div className="text-xs font-semibold uppercase tracking-[0.3em] opacity-80">{t.title}</div>}
          <div className="mt-1 whitespace-pre-wrap text-[13px]">{t.message}</div>
        </div>
      ))}
    </div>
  );
}

