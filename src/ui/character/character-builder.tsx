import { useEffect, useMemo, useState } from 'react';
import type { TraitSpec } from '../../store/character';
import { useGlobalBus } from '../../bus/global-bus';
import { TRAITS } from '../../domain/character/traits';
import { cn } from '../../lib/utils';
import { useI18n } from '../../i18n';
import { useCharacterAssembly, type Publish } from '../../domain/character/hooks/use-character-assembly';
import { useCharacterNetwork } from '../../domain/character/hooks/use-character-network';

type FilterOption = 'all' | 'positive' | 'negative';

type Props = {
  onClose: () => void;
  playerName?: string;
  localParticipantId: string | null;
  publish: Publish;
};

export function CharacterBuilder({ onClose, playerName = 'Player', localParticipantId, publish }: Props) {
  const { t: tt } = useI18n();
  const bus = useGlobalBus();
  const {
    roll,
    budget,
    remaining,
    stats,
    passives,
    traits,
    ensureRoll,
    addTrait,
    removeTrait,
    finalizeCharacter,
    getSummary
  } = useCharacterAssembly();

  useEffect(() => {
    ensureRoll();
  }, [ensureRoll]);

  const add = (trait: TraitSpec) => addTrait(trait);
  const remove = (id: string) => removeTrait(id);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterOption>('all');
  const canFinalize = remaining >= 0;
  const { sendLoadout, sendReset } = useCharacterNetwork({ localParticipantId, publish });
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TRAITS.filter((t) => {
      if (typeFilter === 'positive' && t.cost < 0) return false;
      if (typeFilter === 'negative' && t.cost > 0) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [query, typeFilter]);

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-[min(1080px,96vw)] max-h-[90vh] overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary/80">{tt('char.subtitle')}</p>
            <h3 className="text-xl font-semibold">{tt('char.title')}</h3>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-md border border-border/60 px-2 py-1">{tt('char.roll')}: {roll ? roll.join(' / ') : '—'}</span>
            <span className="rounded-md border border-border/60 px-2 py-1">{tt('char.budget')}: {budget}</span>
            <span className={cn('rounded-md border px-2 py-1', remaining >= 0 ? 'border-primary text-primary' : 'border-destructive text-destructive')}>{tt('char.remaining')}: {remaining}</span>
          </div>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-3">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">{tt('char.stats')}</h4>
            <ul className="space-y-2 text-sm">
              {Object.entries(stats).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-3 py-2">
                  <span>{k}</span>
                  <span className="font-semibold">{v}</span>
                </li>
              ))}
            </ul>
            <h4 className="mt-4 text-sm font-semibold">{tt('char.passives')}</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {passives.length === 0 && <li className="rounded-md border border-border/60 bg-background/50 px-3 py-2">—</li>}
              {passives.map((p) => (
                <li key={p.id} className={cn('rounded-md border px-3 py-2', p.negative ? 'border-destructive/60 bg-destructive/5 text-destructive' : 'border-border/60 bg-background/50')}>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2">{p.description}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="col-span-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">{tt('char.traits')}</h4>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tt('char.searchPlaceholder')}
                  className="w-44 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-xs"
                />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as FilterOption)}
                  className="rounded-md border border-border/60 bg-background/60 px-2 py-1 text-xs"
                >
                  <option value="all">{tt('char.filter.all')}</option>
                  <option value="positive">{tt('char.filter.positive')}</option>
                  <option value="negative">{tt('char.filter.negative')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((t) => {
                const picked = traits.some((s) => s.id === t.id);
                const willExceed = !picked && (remaining - t.cost) < 0;
                return (
                  <div key={t.id} className={cn('rounded-xl border px-4 py-3', picked ? 'border-primary bg-primary/10' : willExceed ? 'border-border/60 opacity-60' : 'border-border/60 bg-background/60')}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className={cn('text-xs', t.cost >= 0 ? 'text-primary' : 'text-emerald-400')}>{t.cost >= 0 ? `- ${t.cost}` : `+ ${Math.abs(t.cost)}`} {tt('char.pts')}</div>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                    {t.statMods && (
                      <p className="mt-2 text-[11px] text-muted-foreground">{Object.entries(t.statMods).map(([k, v]) => `${k} ${v!>=0?'+':''}${v}`).join(', ')}</p>
                    )}
                    <div className="mt-2 flex justify-end">
                      {picked ? (
                        <button className="rounded-md border border-border/60 px-2 py-1 text-xs hover:border-destructive hover:text-destructive" onClick={() => remove(t.id)}>{tt('common.remove')}</button>
                      ) : (
                        <button className="rounded-md border border-border/60 px-2 py-1 text-xs hover:border-primary hover:text-primary" disabled={willExceed} onClick={() => add(t)}>{tt('common.add')}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
          <div className="text-xs text-muted-foreground">{tt('char.note')}</div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-md border border-border/60 px-3 py-2 text-xs hover:border-destructive hover:text-destructive"
              onClick={() => {
                if (localParticipantId) {
                  sendReset();
                }
                onClose();
              }}
            >
              {tt('common.later')}
            </button>
            <button
              disabled={!canFinalize}
              className={cn('rounded-md border px-3 py-2 text-xs', canFinalize ? 'border-primary text-primary hover:bg-primary/10' : 'cursor-not-allowed opacity-50')}
              onClick={() => {
                try {
                  const summary = getSummary();
                  const statsLine = Object.entries(summary.stats).map(([k, v]) => `${k}:${v}`).join(', ');
                  const traitNames = summary.traits.map((t) => t.name).join(', ') || '—';
                  const passiveNames = summary.passives.map((p) => p.name).join(', ') || '—';
                  const body = tt('char.broadcast', { playerName, stats: statsLine, traits: traitNames, passives: passiveNames });
                  finalizeCharacter({
                    publish,
                    localParticipantId,
                    body
                  });
                  sendLoadout();
                  bus.publish('toast:show', { title: tt('char.ready'), message: playerName, status: 'success', durationMs: 2500 });
                } catch {}
                onClose();
              }}
            >
              {tt('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
