import { useEffect, useMemo, useState } from 'react';
import { WORLD_STATIC } from '../../domain/world/data';
import { worldPositionsClient } from '../../domain/net-objects/world-positions-client';
import type { PublishLobbyMessage } from '../../domain/chat/use-lobby-chat';
import type { SessionParticipant } from '../../domain/session/types';

type Props = {
  localParticipantId: string | null;
  participants: SessionParticipant[];
  publish: PublishLobbyMessage;
};

export function MapMini({ localParticipantId, participants, publish }: Props) {
  const [positions, setPositions] = useState(worldPositionsClient.getAll());
  useEffect(() => worldPositionsClient.subscribe(setPositions), []);

  const local = useMemo(() => (localParticipantId ? worldPositionsClient.getFor(localParticipantId) : null), [positions, localParticipantId]);
  const mapId = local?.mapId ?? WORLD_STATIC.head;
  const mapIndex = Math.max(0, WORLD_STATIC.maps.findIndex((m) => m.id === mapId));

  const handleTravel = (dir: 'next' | 'prev') => {
    if (!localParticipantId) return;
    publish('map:travel:request' as any, { requesterId: localParticipantId, direction: dir } as any, 'ui:travel');
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

