import { getHostObject } from '../net-objects/registry.js';
import { worldNpcs } from '../net-objects/world-npcs.js';
import { actorsMeta } from '../net-objects/actors-meta.js';
import { WORLD_ACTORS_OBJECT_ID } from '../net-objects/object-ids.js';
import type { HostWorldActorsObject } from '../net-objects/world-actors-host.js';
import { computeDamage } from '../combat/damage';

export type TickState = { cooldowns: Record<string, number>; aggro: Map<string, number>; forcedTargetId?: string; forcedUntil?: number };
const npcTickState = new Map<string, TickState>();
let _npcTickTimer: ReturnType<typeof setInterval> | null = null;

export function getTickState(npcId: string): TickState {
  const cur = npcTickState.get(npcId);
  if (cur) return cur;
  const init: TickState = { cooldowns: {}, aggro: new Map() };
  npcTickState.set(npcId, init);
  return init;
}

export function applyTaunt(targetNpcId: string, byActorId: string, durationMs = 3000): void {
  const st = getTickState(targetNpcId);
  st.forcedTargetId = byActorId;
  st.forcedUntil = Date.now() + Math.max(500, durationMs);
}

export function addAggro(npcId: string, targetId: string, delta: number) {
  const st = getTickState(npcId);
  st.aggro.set(targetId, (st.aggro.get(targetId) ?? 0) + delta);
}

function resolveFactionOfActor(actorId: string): string | null {
  try {
    const raw = actorsMeta.host.getObject()?.getSnapshot()?.value as unknown;
    const list = Array.isArray((raw as { list?: unknown })?.list)
      ? ((raw as { list: Array<{ id: string; faction?: string }> }).list)
      : [];
    return (list.find((e) => e.id === actorId)?.faction ?? null) as string | null;
  } catch { return null; }
}

export function addAggroToEnemies(targetId: string, delta: number, onlyEngaged = true) {
  const faction = resolveFactionOfActor(targetId);
  const raw = worldNpcs.host.getObject()?.getSnapshot()?.value as unknown;
  const list = Array.isArray((raw as { list?: unknown })?.list)
    ? ((raw as { list: Array<{ id: string; stance: string; faction: string; kind: string }> }).list)
    : [];
  for (const n of list) {
    if (onlyEngaged && n.stance !== 'engage') continue;
    // If faction differs or kind indicates enemy/boss, treat as hostile NPC
    const hostile = (faction && n.faction && n.faction !== faction) || n.kind === 'enemy' || n.kind === 'boss';
    if (!hostile) continue;
    addAggro(n.id, targetId, delta);
  }
}

export function tauntEnemies(taunterId: string, durationMs = 3000, onlyEngaged = true) {
  const faction = resolveFactionOfActor(taunterId);
  const raw = worldNpcs.host.getObject()?.getSnapshot()?.value as unknown;
  const list = Array.isArray((raw as { list?: unknown })?.list)
    ? ((raw as { list: Array<{ id: string; stance: string; faction: string; kind: string }> }).list)
    : [];
  const until = Date.now() + Math.max(500, durationMs);
  for (const n of list) {
    if (onlyEngaged && n.stance !== 'engage') continue;
    const hostile = (faction && n.faction && n.faction !== faction) || n.kind === 'enemy' || n.kind === 'boss';
    if (!hostile) continue;
    const st = getTickState(n.id);
    st.forcedTargetId = taunterId;
    st.forcedUntil = until;
  }
}

export function setCooldown(npcId: string, abilityId: string, until: number) {
  const st = getTickState(npcId);
  st.cooldowns[abilityId] = until;
}

export function startNpcTickScheduler() {
  if (_npcTickTimer) return;
  _npcTickTimer = setInterval(() => {
    try {
      const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
      const npcsHost = worldNpcs.host.getObject();
      if (!actors || !npcsHost) return;
      const raw = npcsHost.getSnapshot()?.value as unknown;
      const list = Array.isArray((raw as { list?: unknown })?.list)
        ? ((raw as { list: Array<{ id: string; stance: string }> }).list)
        : [];
      const engaged = list.filter((n) => n.stance === 'engage').slice(0, 8);
      const actorList = actors.getAll();
      const now = Date.now();
      for (const n of engaged) {
        const st = getTickState(n.id);
        const cd = st.cooldowns['basic'] ?? 0;
        if (now < cd) continue;
        // forced taunt target override
        let targetId = (st.forcedUntil && st.forcedUntil > now) ? st.forcedTargetId : undefined;
        if (!targetId) {
          targetId = Array.from(st.aggro.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
        }
        if (!targetId) continue;
        const attacker = actorList.find((a) => a.id === n.id);
        const defender = actorList.find((a) => a.id === targetId);
        if (!attacker || !defender) continue;
        const dmg = computeDamage({ attackerDerived: attacker.derived ?? undefined, defenderResists: defender.modifiers?.resists ?? {} });
        actors.hpAdd(targetId, -dmg);
        st.cooldowns['basic'] = now + 1500;
        st.aggro.set(targetId, (st.aggro.get(targetId) ?? 0) + dmg);
      }
    } catch {}
  }, 1000);
}
