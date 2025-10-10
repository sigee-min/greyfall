import React, { useEffect, useMemo, useState } from 'react';
import type { RegisterLobbyHandler, PublishLobbyMessage } from '../../domain/chat/use-lobby-chat';
import { useTravelVote } from '../../domain/world/travel/use-travel-vote';
import { WORLD_STATIC } from '../../domain/world/data';
import { useI18n } from '../../i18n';

type Props = {
  localParticipantId: string | null;
  publishLobbyMessage: PublishLobbyMessage;
  registerLobbyHandler: RegisterLobbyHandler;
};

export function MinimapTravelChip({ localParticipantId, publishLobbyMessage, registerLobbyHandler }: Props) {
  const { t } = useI18n();
  const { state, computed, actions, expanded: _expanded } = useTravelVote({ localParticipantId, publishLobbyMessage, registerLobbyHandler, sessionMode: null });
  const [open, setOpen] = useState(false);
  const isActive = computed.isActive;
  const mapName = useMemo(() => (state.targetMapId ? (WORLD_STATIC.maps.find((m) => m.id === state.targetMapId)?.name ?? state.targetMapId) : ''), [state.targetMapId]);


  const pct = Math.round(computed.progressPct * 100);
  const seconds = computed.secondsLeft;
  const barColor = pct >= 66 ? '#22c55e' : pct >= 33 ? '#f59e0b' : '#ef4444';
  const secColor = seconds > 10 ? 'text-foreground' : seconds > 5 ? 'text-yellow-400' : 'text-destructive';

  const handleToggle = () => setOpen((v) => !v);
  const handleYes = () => actions.vote(true);
  const handleNo = () => actions.vote(false);
  const handleCancel = () => actions.cancel();

  // Keyboard shortcuts when panel open: Y/N vote, Esc close, C cancel (host)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'y' || e.key === 'Y') { handleYes(); }
      else if (e.key === 'n' || e.key === 'N') { handleNo(); }
      else if (e.key === 'c' || e.key === 'C') { if (computed.canCancel) handleCancel(); }
      else if (e.key === 'Escape') { setOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, computed.canCancel, handleYes, handleNo, handleCancel]);

  if (!isActive && !open) return null;

  return (
    <div className="absolute left-[16px] top-[16px] z-30" aria-live="polite">
      {!open ? (
        <button
          type="button"
          className="rounded-md border border-border/60 bg-background/80 px-3 py-2 text-[11px] font-semibold hover:border-primary hover:text-primary"
          onClick={handleToggle}
          aria-label={t('map.travel.openPanel')}
          title={t('map.travel.openPanel')}
        >
          {t('map.travel.progress', { count: state.yes + state.no, total: state.total })} · <span className={secColor}>{t('map.travel.secondsShort', { seconds })}</span>
          <div
            className="mt-1 h-1 w-full rounded bg-border"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('map.travel.progress', { count: state.yes + state.no, total: state.total })}
            title={`${pct}%`}
          >
            <div className="h-1 rounded transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
        </button>
      ) : (
        <div className="w-[260px] rounded-xl border border-border/60 bg-background/90 p-3 shadow-xl" role="region" aria-label={t('map.travel.votePanel')}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold">{t('map.travel.votePanel')}</div>
            <button type="button" className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-primary" onClick={handleToggle} aria-label={t('common.close')}>×</button>
          </div>
          <div className="text-[12px] text-muted-foreground">{t('map.travel.target')}: <span className="font-semibold text-foreground">{mapName || '—'}</span></div>
          <div className="mt-1 text-[12px] text-muted-foreground">{t('common.yes')}: {state.yes} · {t('common.no')}: {state.no} · {t('map.travel.total')}: {state.total} · {t('map.travel.secondsShort', { seconds })}</div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-md border border-border/60 px-3 py-1 text-[12px] hover:border-primary hover:text-primary" onClick={handleYes} aria-label={t('map.travel.voteYes')} title={t('map.travel.voteYes')}>{t('common.yes')}</button>
            <button type="button" className="rounded-md border border-border/60 px-3 py-1 text-[12px] hover:border-primary hover:text-primary" onClick={handleNo} aria-label={t('map.travel.voteNo')} title={t('map.travel.voteNo')}>{t('common.no')}</button>
            {computed.canCancel && (
              <button type="button" className="ml-auto rounded-md border border-destructive/60 px-3 py-1 text-[12px] text-destructive hover:border-destructive hover:bg-destructive/10" onClick={handleCancel} aria-label={t('map.travel.cancelProposal')} title={t('map.travel.cancelProposal')}>{t('common.cancel')}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
