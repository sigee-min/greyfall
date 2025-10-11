import React from 'react';
import { cn } from '../../lib/utils';
import { useQuestStore, selectActiveQuest } from '../../domain/quest/store';

type Props = {
  className?: string;
  onOpenJournal?: () => void;
};

export function QuestTracker({ className, onOpenJournal }: Props) {
  const active = useQuestStore(selectActiveQuest);

  if (!active || !active.progress || !active.quest) {
    return null;
  }

  const { quest, progress } = active;
  const stage = quest.stages[Math.max(0, progress.stageIdx)] ?? quest.stages[0];
  const objs = stage?.objectives ?? [];
  const progById = new Map(progress.objectives.map((o) => [o.id, o] as const));

  return (
    <div className={cn('rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{quest.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{stage?.title}</p>
        </div>
        {onOpenJournal && (
          <button
            type="button"
            onClick={onOpenJournal}
            className="rounded border border-border/60 bg-background/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:border-primary hover:text-primary"
            title="Open Journal"
          >
            Journal
          </button>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {objs.slice(0, 3).map((o) => {
          const p = progById.get(o.id);
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
    </div>
  );
}

