import { useEffect, useMemo, useState } from 'react';
import { WORLD_STATIC } from '../../domain/world/data';
import { worldPositionsClient } from '../../domain/net-objects/world-positions-client';
import type { PublishLobbyMessage, RegisterLobbyHandler } from '../../domain/chat/use-lobby-chat';
import { useTravelSession } from '../../domain/world/travel-session';
import { useGlobalBus } from '../../bus/global-bus';
import type { SessionParticipant } from '../../domain/session/types';
import { useI18n } from '../../i18n';

type Props = {
  localParticipantId: string | null;
  participants: SessionParticipant[];
  publish: PublishLobbyMessage;
  register: RegisterLobbyHandler;
};

export function MapMini({ localParticipantId, participants, publish, register }: Props) {
  const { t } = useI18n();
  const bus = useGlobalBus();
  const [positions, setPositions] = useState(worldPositionsClient.getAll());
  useEffect(() => worldPositionsClient.subscribe(setPositions), []);
  const travel = useTravelSession();
  const vote = travel.status === 'idle' ? null : {
    inviteId: travel.inviteId || '',
    targetMapId: travel.targetMapId || WORLD_STATIC.head,
    yes: travel.yes,
    no: travel.no,
    total: travel.total,
    quorum: travel.quorum,
    status: travel.status
  } as const;
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [policy, setPolicy] = useState<'majority' | 'all'>('majority');
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const local = useMemo(() => {
    if (!localParticipantId) return null;
    return positions.find((position) => position.id === localParticipantId) ?? null;
  }, [positions, localParticipantId]);
  const mapId = local?.mapId ?? WORLD_STATIC.head;
  const mapIndex = Math.max(0, WORLD_STATIC.maps.findIndex((m) => m.id === mapId));
  const localRole = useMemo(() => participants.find((p) => p.id === localParticipantId)?.role ?? 'guest', [participants, localParticipantId]);

  useEffect(() => {
    if (!vote) return;
    if (vote.status === 'proposed' && deadlineAt == null) {
      setDeadlineAt(Date.now() + 60_000);
    }
    if (vote.status === 'approved' || vote.status === 'rejected' || vote.status === 'cancelled') {
      const mapName = WORLD_STATIC.maps.find((m) => m.id === vote.targetMapId)?.name ?? vote.targetMapId;
      const statusTitle = vote.status === 'approved' ? t('map.travel.approved') : vote.status === 'rejected' ? t('map.travel.rejected') : t('map.travel.cancelled');
      const statusKind: 'success' | 'warning' | 'info' = vote.status === 'approved' ? 'success' : vote.status === 'rejected' ? 'warning' : 'info';
      bus.publish('toast:show', { title: statusTitle, message: `→ ${mapName}`, status: statusKind, durationMs: 2500 });
      const id = window.setTimeout(() => {
        setDeadlineAt(null);
      }, 2000);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [bus, t, vote, deadlineAt]);

  const handleTravel = (dir: 'next' | 'prev') => {
    if (!localParticipantId) return;
    publish('map:travel:propose', { requesterId: localParticipantId, direction: dir, quorum: policy }, 'ui:travel:propose');
  };

  const voteYes = () => {
    if (!localParticipantId || !vote) return;
    publish('map:travel:vote', { inviteId: vote.inviteId, voterId: localParticipantId, approve: true }, 'ui:travel:vote');
  };
  const voteNo = () => {
    if (!localParticipantId || !vote) return;
    publish('map:travel:vote', { inviteId: vote.inviteId, voterId: localParticipantId, approve: false }, 'ui:travel:vote');
  };

  const cancelTravel = () => {
    if (!localParticipantId || !vote) return;
    if (localRole !== 'host') return;
    publish('map:travel:cancel', { inviteId: vote.inviteId, byId: localParticipantId }, 'ui:travel:cancel');
  };

  const occupancyByField = useMemo(() => {
    const map = WORLD_STATIC.maps[mapIndex];
    const byField: Record<string, string[]> = {};
    for (const f of map.fields) byField[f.id] = [];
    for (const p of positions) {
      if (p.mapId !== map.id) continue;
      const name = participants.find((x) => x.id === p.id)?.name ?? p.id;
      if (!byField[p.fieldId]) byField[p.fieldId] = [];
      byField[p.fieldId].push(name);
    }
    return byField;
  }, [mapIndex, participants, positions]);

  const mapNames = WORLD_STATIC.maps.map((m) => m.name);

  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('map.journey')}</p>
        <div className="flex gap-2">
          {localRole === 'host' && (
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value as 'majority' | 'all')}
              className="rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[11px]"
              title={t('map.vote.policy')}
            >
              <option value="majority">{t('map.vote.majority')}</option>
              <option value="all">{t('map.vote.all')}</option>
            </select>
          )}
          <button className="rounded-md border border-border/60 px-2 py-1 text-xs hover:border-primary hover:text-primary" onClick={() => handleTravel('prev')}>{t('common.prev')}</button>
          <button className="rounded-md border border-border/60 px-2 py-1 text-xs hover:border-primary hover:text-primary" onClick={() => handleTravel('next')}>{t('common.next')}</button>
        </div>
      </div>
      {vote && (
        <div className="mb-3 rounded-md border border-primary/60 bg-primary/10 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span>{t('map.travel.vote')} → {WORLD_STATIC.maps.find((m) => m.id === vote.targetMapId)?.name ?? vote.targetMapId}</span>
            <span className="text-[10px] text-muted-foreground">{vote.yes}/{vote.total} {t('common.yes')}{deadlineAt ? ` · ${Math.max(0, Math.ceil((deadlineAt - now) / 1000))}s` : ''}</span>
          </div>
          {vote.status === 'proposed' && (
            <div className="mt-2 flex gap-2">
              <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary" onClick={voteYes}>{t('common.yes')}</button>
              <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary" onClick={voteNo}>{t('common.no')}</button>
              {localRole === 'host' && (
                <button className="ml-auto rounded-md border border-destructive/60 px-2 py-1 text-[11px] text-destructive hover:border-destructive hover:bg-destructive/10" onClick={cancelTravel}>{t('common.cancel')}</button>
              )}
            </div>
          )}
          {vote.status !== 'proposed' && (
            <div className="mt-2 text-[11px] text-muted-foreground">{vote.status}</div>
          )}
        </div>
      )}
      <div className="mb-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">{mapNames.slice(Math.max(0, mapIndex - 1), mapIndex + 2).join('  →  ')}</span>
      </div>
      <div className="space-y-2">
        {WORLD_STATIC.maps[mapIndex].fields.map((f) => (
          <div key={f.id} className="rounded-md border border-border/60 bg-background/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{f.name}</span>
              <span className="text-[10px] text-muted-foreground">{f.kind}</span>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {(occupancyByField[f.id] ?? []).length > 0 ? (occupancyByField[f.id] ?? []).join(', ') : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
