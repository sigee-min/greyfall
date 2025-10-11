import React from 'react';
import { cn } from '../../lib/utils';
import { useQuestStore } from '../../domain/quest/store';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function QuestJournal({ open, onClose }: Props) {
  const snapshot = useQuestStore((s) => s.snapshot);
  const catalog = useQuestStore((s) => s.catalog);

  if (!open) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md supports-[backdrop-filter]:bg-black/50" onClick={onClose} />
      <div className="relative mx-auto mt-16 w-[min(920px,94vw)] rounded-xl border border-border/60 bg-background/70 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Quest Journal</h2>
          <button type="button" className="rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-[12px]" onClick={onClose}>Close</button>
        </div>
        <div className="grid gap-6 px-6 py-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Active/Completed</h3>
            <ul className="space-y-2">
              {snapshot.quests.map((q) => {
                const meta = catalog[q.id];
                const stage = meta?.stages[Math.max(0, q.stageIdx)] ?? meta?.stages[0];
                return (
                  <li key={q.id} className={cn('rounded-lg border border-border/60 bg-background/70 px-3 py-2', q.status === 'completed' ? 'opacity-80' : undefined)}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{meta?.title ?? q.id}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{stage?.title ?? '-'}</p>
                      </div>
                      <span className={cn('ml-3 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em]', q.status === 'completed' ? 'bg-primary/20 text-primary' : q.status === 'failed' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground')}>{q.status}</span>
                    </div>
                    {stage?.objectives?.length ? (
                      <ul className="mt-2 space-y-1 text-[12px]">
                        {stage.objectives.map((o) => {
                          const p = q.objectives.find((x) => x.id === o.id);
                          const need = Math.max(1, o.count ?? 1);
                          const have = Math.min(need, p?.progress ?? 0);
                          const done = Boolean(p?.done);
                          return (
                            <li key={o.id} className="flex items-center gap-2">
                              <span className={cn('inline-block h-3 w-3 rounded-full border', done ? 'bg-primary border-primary' : 'bg-muted border-border/60')} />
                              <span className={cn('truncate', done ? 'text-foreground' : 'text-muted-foreground')}>{o.description ?? o.id}</span>
                              {need > 1 && (
                                <span className="ml-auto tabular-nums text-[11px] text-muted-foreground">{have}/{need}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
              {snapshot.quests.length === 0 && (
                <li className="rounded-lg border border-dashed border-border/60 bg-background/60 px-3 py-2 text-center text-[12px] text-muted-foreground">No quests yet</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Catalog</h3>
            <ul className="space-y-2">
              {Object.values(catalog).map((q) => (
                <li key={q.id} className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <p className="font-semibold">{q.title}</p>
                  {q.summary && <p className="text-[12px] text-muted-foreground">{q.summary}</p>}
                </li>
              ))}
              {Object.keys(catalog).length === 0 && (
                <li className="rounded-lg border border-dashed border-border/60 bg-background/60 px-3 py-2 text-center text-[12px] text-muted-foreground">No catalog</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

