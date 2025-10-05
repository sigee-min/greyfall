import { useEffect, useMemo, useState } from 'react';
import { WORLD_STATIC } from '../../domain/world/data';
import { worldPositionsClient } from '../../domain/net-objects/world-positions-client';
import type { PublishLobbyMessage } from '../../domain/chat/use-lobby-chat';
import type { SessionParticipant } from '../../domain/session/types';
import type { LobbyMessage } from '../../protocol';

type Props = {
  localParticipantId: string | null;
  participants: SessionParticipant[];
  publish: PublishLobbyMessage;
};

export function MapMini({ localParticipantId, participants, publish }: Props) {
  const [positions, setPositions] = useState(worldPositionsClient.getAll());
  useEffect(() => worldPositionsClient.subscribe(setPositions), []);
  const [vote, setVote] = useState<{ inviteId: string; targetMapId: string; yes: number; no: number; total: number; quorum: 'majority' | 'all'; status: 'proposed' | 'approved' | 'rejected' | 'cancelled' } | null>(null);

  const local = useMemo(() => (localParticipantId ? worldPositionsClient.getFor(localParticipantId) : null), [positions, localParticipantId]);
  const mapId = local?.mapId ?? WORLD_STATIC.head;
  const mapIndex = Math.max(0, WORLD_STATIC.maps.findIndex((m) => m.id === mapId));

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      let payload: any = null;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      const msg = payload as LobbyMessage;
      if (msg?.kind === 'map:travel:update') {
        const b: any = msg.body;
        setVote({ inviteId: String(b.inviteId), targetMapId: String(b.targetMapId), yes: Number(b.yes), no: Number(b.no), total: Number(b.total), quorum: b.quorum, status: b.status });
        if (b.status === 'approved' || b.status === 'rejected' || b.status === 'cancelled') {
          // clear after short delay
          setTimeout(() => setVote(null), 2000);
        }
      }
    };
    // Attach to global datachannel if available via window? we don't have direct channel here
    // As a simple approach, rely on registerLobbyHandler elsewhere; leaving this as no-op.
    return () => {};
  }, []);

  const handleTravel = (dir: 'next' | 'prev') => {
    if (!localParticipantId) return;
    publish('map:travel:propose' as any, { requesterId: localParticipantId, direction: dir, quorum: 'majority' } as any, 'ui:travel:propose');
  };

  const voteYes = () => {
    if (!localParticipantId || !vote) return;
    publish('map:travel:vote' as any, { inviteId: vote.inviteId, voterId: localParticipantId, approve: true } as any, 'ui:travel:vote');
  };
  const voteNo = () => {
    if (!localParticipantId || !vote) return;
    publish('map:travel:vote' as any, { inviteId: vote.inviteId, voterId: localParticipantId, approve: false } as any, 'ui:travel:vote');
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
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Journey</p>
        <div className="flex gap-2">
          <button className="rounded-md border border-border/60 px-2 py-1 text-xs hover:border-primary hover:text-primary" onClick={() => handleTravel('prev')}>Prev</button>
          <button className="rounded-md border border-border/60 px-2 py-1 text-xs hover:border-primary hover:text-primary" onClick={() => handleTravel('next')}>Next</button>
        </div>
      </div>
      {vote && (
        <div className="mb-3 rounded-md border border-primary/60 bg-primary/10 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span>Travel vote → {WORLD_STATIC.maps.find((m) => m.id === vote.targetMapId)?.name ?? vote.targetMapId}</span>
            <span className="text-[10px] text-muted-foreground">{vote.yes}/{vote.total} yes</span>
          </div>
          {vote.status === 'proposed' && (
            <div className="mt-2 flex gap-2">
              <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary" onClick={voteYes}>Yes</button>
              <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary" onClick={voteNo}>No</button>
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
