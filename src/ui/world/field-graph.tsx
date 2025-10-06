import { useEffect, useMemo, useState } from 'react';
import { WORLD_STATIC } from '../../domain/world/data';
import { useI18n } from '../../i18n';
import { worldPositionsClient } from '../../domain/net-objects/world-positions-client';
import type { PublishLobbyMessage } from '../../domain/chat/use-lobby-chat';
import type { SessionParticipant } from '../../domain/session/types';

type Props = {
  localParticipantId: string | null;
  participants: SessionParticipant[];
  publish: PublishLobbyMessage;
};

export function FieldGraph({ localParticipantId, participants, publish }: Props) {
  const { t } = useI18n();
  const [positions, setPositions] = useState(worldPositionsClient.getAll());
  useEffect(() => worldPositionsClient.subscribe(setPositions), []);

  const local = useMemo(() => {
    return localParticipantId ? worldPositionsClient.getFor(localParticipantId) : null;
  }, [positions, localParticipantId]);

  const map = useMemo(() => {
    const mid = local?.mapId ?? WORLD_STATIC.head;
    return WORLD_STATIC.maps.find((m) => m.id === mid) ?? WORLD_STATIC.maps[0];
  }, [local]);

  const currentFieldId = local?.fieldId ?? map.entryFieldId;

  const handleMove = (toFieldId: string) => {
    if (!localParticipantId) return;
    if (toFieldId === currentFieldId) return;
    publish('field:move:request' as any, {
      playerId: localParticipantId,
      mapId: map.id,
      fromFieldId: currentFieldId,
      toFieldId
    } as any, 'ui:move');
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t('map.title')}</p>
        <span className="text-sm font-semibold">{map.name}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {map.fields.map((f) => {
          const isHere = f.id === currentFieldId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => handleMove(f.id)}
              className={
                'rounded-md border px-3 py-2 text-left text-xs transition ' +
                (isHere
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border hover:border-primary/60 hover:bg-primary/5')
              }
              title={f.description}
            >
              <div className="font-semibold">{f.name}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{f.kind}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground">{t('interact.note')}</div>
    </div>
  );
}
