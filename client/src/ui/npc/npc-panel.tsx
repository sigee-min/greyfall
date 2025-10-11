import { useEffect, useMemo, useState } from 'react';
import { worldNpcs, type NpcPublicEntry } from '../../domain/net-objects/world-npcs';
import type { PublishLobbyMessage, RegisterLobbyHandler } from '../../domain/chat/use-lobby-chat';
import { useGlobalBus } from '../../bus/global-bus';
import { worldActorsClient, type ActorEntry } from '../../domain/net-objects/world-actors-client';

type Props = {
  localParticipantId: string | null;
  publish: PublishLobbyMessage | null;
  register: RegisterLobbyHandler | null;
};

export function NpcPanel({ localParticipantId, publish, register }: Props) {
  const [list, setList] = useState<NpcPublicEntry[]>(() => worldNpcs.client.getList());
  const [actors, setActors] = useState<ActorEntry[]>(() => worldActorsClient.getAll());
  const [inputByNpc, setInputByNpc] = useState<Record<string, string>>({});
  const bus = useGlobalBus();

  useEffect(() => {
    const unsub = worldNpcs.client.subscribe((next) => setList(next));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    const unsub = worldActorsClient.subscribe((next) => setActors(next as ActorEntry[]));
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (!register) return;
    const unsub = register('npc:chat:result', (msg) => {
      const body = msg.body as { npcId: string; text: string };
      const { npcId, text } = body;
      bus.publish('toast:show', { status: 'info', title: `NPC 응답`, message: `${npcId}: ${text}`, durationMs: 2000 });
    });
    return unsub;
  }, [bus, register]);

  const items = useMemo(() => list.slice(0, 5), [list]);

  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="uppercase tracking-[0.28em] text-muted-foreground">NPCs</span>
      </div>
      <div className="space-y-2">
        {items.map((n) => (
          <div key={n.id} className="rounded-md border border-border/60 bg-background/50 p-2">
            <div className="flex items-center justify-between">
              <div className="text-foreground/90">
                <strong>{n.name}</strong>
                <span className="ml-2 text-muted-foreground">{n.faction} · {n.kind}</span>
                {n.hp && <span className="ml-2 text-muted-foreground">HP {n.hp.cur}/{n.hp.max}</span>}
              </div>
              <div className="text-muted-foreground">{n.stance} · {n.mood}</div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {(actors.find((a) => a.id === n.id)?.status ?? []).slice(0, 4).map((s, i) => (
                <span key={i} className="rounded bg-background/60 px-1 py-0.5 text-[10px] text-foreground/80 border border-border/60">{s}</span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className="w-full rounded border border-border/60 bg-background/60 px-2 py-1 text-[11px]"
                placeholder="말을 건다…"
                value={inputByNpc[n.id] ?? ''}
                onChange={(e) => setInputByNpc((m) => ({ ...m, [n.id]: e.currentTarget.value }))}
              />
              <button
                className="rounded border border-border/60 px-2 py-1 text-[11px] hover:border-primary hover:text-primary"
                onClick={() => {
                  if (!publish || !localParticipantId) return;
                  const text = (inputByNpc[n.id] ?? '').trim() || '안녕?';
                  publish('npc:chat:request', { npcId: n.id, fromId: localParticipantId, text, mode: 'say' }, 'ui:npc:talk');
                }}
              >Talk</button>
              <button
                className="rounded border border-border/60 px-2 py-1 text-[11px] hover:border-destructive hover:text-destructive"
                onClick={() => {
                  if (!publish || !localParticipantId) return;
                  publish('npc:use:request', { npcId: n.id, abilityId: 'basic', targetId: localParticipantId || undefined }, 'ui:npc:attack');
                }}
              >Engage</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
