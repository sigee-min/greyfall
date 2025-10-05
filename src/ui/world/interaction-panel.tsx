import { useEffect, useMemo, useState } from 'react';
import type { SessionParticipant } from '../../domain/session/types';
import type { PublishLobbyMessage, RegisterLobbyHandler } from '../../domain/chat/use-lobby-chat';
import { worldPositionsClient } from '../../domain/net-objects/world-positions-client';
import { useInteractions } from '../../domain/interactions/use-interactions';

type Props = {
  localParticipantId: string | null;
  participants: SessionParticipant[];
  publish: PublishLobbyMessage;
  register: RegisterLobbyHandler;
};

export function InteractionPanel({ localParticipantId, participants, publish, register }: Props) {
  const [positions, setPositions] = useState(worldPositionsClient.getAll());
  useEffect(() => worldPositionsClient.subscribe(setPositions), []);
  const local = useMemo(() => (localParticipantId ? worldPositionsClient.getFor(localParticipantId) : null), [positions, localParticipantId]);
  const mapId = local?.mapId ?? 'LUMENFORD';
  const fieldId = local?.fieldId ?? 'gate';

  const here = useMemo(() => {
    const ids = positions.filter((p) => p.mapId === mapId && p.fieldId === fieldId).map((p) => p.id);
    return participants.filter((p) => ids.includes(p.id));
  }, [participants, positions, mapId, fieldId]);

  const { incoming, outgoing, sendInvite, acceptInvite, cancelInvite } = useInteractions({ localParticipantId, mapId, fieldId, publish, register });

  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Interact</p>
        <span className="text-xs text-muted-foreground">{here.length} here</span>
      </div>
      <div className="space-y-2">
        {here.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-2">
            <div className="text-xs font-semibold">{p.name}</div>
            {p.id !== localParticipantId ? (
              <div className="flex gap-2">
                <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary" onClick={() => sendInvite(p.id, 'trade')}>Trade</button>
                <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary" onClick={() => sendInvite(p.id, 'assist')}>Assist</button>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">You</span>
            )}
          </div>
        ))}
      </div>
      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="mt-3 space-y-2">
          {incoming.map((i) => (
            <div key={i.inviteId} className="flex items-center justify-between rounded-md border border-primary/60 bg-primary/10 px-3 py-2 text-xs">
              <span>
                {i.verb} from {participants.find((p) => p.id === i.fromId)?.name ?? i.fromId}
              </span>
              <div className="flex gap-2">
                <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary" onClick={() => acceptInvite(i.inviteId)}>Accept</button>
                <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary" onClick={() => cancelInvite(i.inviteId)}>Decline</button>
              </div>
            </div>
          ))}
          {outgoing.map((i) => (
            <div key={i.inviteId} className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-2 text-xs">
              <span>
                Waiting {participants.find((p) => p.id === i.toId)?.name ?? i.toId}… ({i.verb})
              </span>
              <button className="rounded-md border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary" onClick={() => cancelInvite(i.inviteId)}>Cancel</button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 text-[11px] text-muted-foreground">같은 필드에 있는 플레이어와만 상호작용할 수 있습니다.</div>
    </div>
  );
}

