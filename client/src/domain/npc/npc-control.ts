import { defineSyncModel, registerSyncModel } from '../net-objects/sync-model.js';
import { getHostObject } from '../net-objects/registry.js';
import { worldNpcs } from '../net-objects/world-npcs.js';
import { WORLD_ACTORS_OBJECT_ID } from '../net-objects/object-ids.js';
import type { HostWorldActorsObject } from '../net-objects/world-actors-host.js';
import { computeDamage } from '../combat/damage';
import { runDialogue } from './pipeline/dialogue';
import { proposeMemoryOps } from './memory/update';
import { applyMemoryOps } from './memory/store';
import { logNpcReply } from './logs';

type VoidState = null;

const npcControl = defineSyncModel<VoidState>({
  id: 'npc:control',
  initial: () => null,
  requestOnStart: false,
  commands: [
    {
      kind: 'npc:chat:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { npcId, fromId, text, mode } = body as { npcId?: unknown; fromId?: unknown; text?: unknown; mode?: unknown };
        if (typeof npcId !== 'string' || typeof fromId !== 'string' || typeof text !== 'string') return null;
        const m = typeof mode === 'string' && (mode === 'say' || mode === 'ask' || mode === 'request') ? mode : undefined;
        return { npcId, fromId, text, mode: m };
      },
      authorize: () => true,
      handle: async ({ payload, context }) => {
        const { npcId, fromId, text, mode } = payload as { npcId: string; fromId: string; text: string; mode?: 'say'|'ask'|'request' };
        const out = await runDialogue({ npcId, fromId, text, mode });
        context.router.sendLobbyMessage('npc:chat:result', { npcId, toId: fromId, text: out.text, actions: out.actions }, 'npc:chat:result');
        try {
          const ops = proposeMemoryOps({ npcId, fromId, playerText: text, npcReply: out.text });
          applyMemoryOps(npcId, ops);
        } catch {}
        try { await logNpcReply(npcId, fromId, text, out.text); } catch {}
      }
    },
    {
      kind: 'npc:use:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { npcId, abilityId, targetId } = body as { npcId?: unknown; abilityId?: unknown; targetId?: unknown };
        if (typeof npcId !== 'string' || typeof abilityId !== 'string') return null;
        return { npcId, abilityId, targetId: typeof targetId === 'string' ? targetId : undefined };
      },
      authorize: () => true,
      handle: ({ payload, context }) => {
        const { npcId, targetId } = payload as { npcId: string; abilityId: string; targetId?: string };
        if (!targetId) return;
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        if (!actors) return;
        const attacker = actors.getAll().find((a) => a.id === npcId);
        const defender = actors.getAll().find((a) => a.id === targetId);
        if (!attacker || !defender) return;
        const dmg = computeDamage({ attackerDerived: attacker.derived ?? undefined, defenderResists: defender.modifiers?.resists ?? {} });
        actors.hpAdd(targetId, -dmg);
        context.router.sendLobbyMessage('npc:combat:result', { npcId, events: [{ type: 'damage', fromId: npcId, toId: targetId, amount: dmg, kind: 'blunt' }] }, 'npc:combat:damage');
      }
    }
  ]
});

registerSyncModel(npcControl);

// Simple host-side combat tick scheduler (engaged NPCs)
let _npcTickTimer: ReturnType<typeof setInterval> | null = null;
type TickState = { cooldowns: Record<string, number>; aggro: Map<string, number> };
const npcTickState = new Map<string, TickState>();

function getTickState(npcId: string): TickState {
  const cur = npcTickState.get(npcId);
  if (cur) return cur;
  const init: TickState = { cooldowns: {}, aggro: new Map() };
  npcTickState.set(npcId, init);
  return init;
}

function startNpcTickScheduler() {
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
        const state = getTickState(n.id);
        const cooldownUntil = state.cooldowns['basic'] ?? 0;
        if (now < cooldownUntil) continue;
        // pick target by highest aggro
        const targetId = Array.from(state.aggro.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!targetId) continue;
        const attacker = actorList.find((a) => a.id === n.id);
        const defender = actorList.find((a) => a.id === targetId);
        if (!attacker || !defender) continue;
        const dmg = computeDamage({ attackerDerived: attacker.derived ?? undefined, defenderResists: defender.modifiers?.resists ?? {} });
        actors.hpAdd(targetId, -dmg);
        state.cooldowns['basic'] = now + 1500;
        state.aggro.set(targetId, (state.aggro.get(targetId) ?? 0) + dmg);
        // broadcast combat event
        // note: router not available here; rely on NPC use request path for formal events, or extend with a router ref later
      }
    } catch {}
  }, 1000);
}

try { startNpcTickScheduler(); } catch {}
