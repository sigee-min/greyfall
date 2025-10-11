import { defineSyncModel, registerSyncModel } from '../net-objects/sync-model.js';
import { getHostObject } from '../net-objects/registry.js';
import { worldNpcs } from '../net-objects/world-npcs.js';
import { WORLD_ACTORS_OBJECT_ID } from '../net-objects/object-ids.js';
import type { HostWorldActorsObject } from '../net-objects/world-actors-host.js';
import { getProfileByActor } from './profile-registry';
import { addAggroToEnemies, tauntEnemies, getTickState, startNpcTickScheduler } from './aggro';
import { actorsMeta } from '../net-objects/actors-meta.js';
import { applyStatus } from './status-store';
import type { AbilityEffect } from './types';
import { triggers as questTriggers } from '../quest/triggers';
import { questStateSync } from '../quest/sync';
import { useQuestStore } from '../quest/store';
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
        // Host: 대화 트리거를 퀘스트에 반영하고 스냅샷 브로드캐스트
        try {
          questTriggers.onTalk(npcId);
          const snapshot = useQuestStore.getState().snapshot;
          questStateSync.host.set({ snapshot, version: 1, since: Date.now() }, 'quest:talk');
        } catch {}
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
        const { npcId, abilityId, targetId } = payload as { npcId: string; abilityId: string; targetId?: string };
        if (!targetId) return;
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        if (!actors) return;
        const attacker = actors.getAll().find((a) => a.id === npcId);
        const defender = actors.getAll().find((a) => a.id === targetId);
        if (!attacker || !defender) return;
        const prof = getProfileByActor(npcId);
        const ability = prof?.abilities.find((ab) => ab.id === abilityId);
        const kind = ability?.kind ?? 'attack';
        const cdMs = Math.max(500, ability?.cooldownMs ?? 1500);
        const state = getTickState(npcId);
        // Helper: resolve targets based on ability.target spec
        const resolveTargets = (spec: string | undefined, explicitId?: string): string[] => {
          const rawMeta = actorsMeta.host.getObject()?.getSnapshot()?.value as unknown;
          const metaList = Array.isArray((rawMeta as { list?: unknown })?.list)
            ? ((rawMeta as { list: Array<{ id: string; faction?: string; kind?: string }> }).list)
            : [];
          const meFaction = metaList.find((m) => m.id === npcId)?.faction ?? '';
          const rawNpcs = worldNpcs.host.getObject()?.getSnapshot()?.value as unknown;
          const npcs = Array.isArray((rawNpcs as { list?: unknown })?.list)
            ? ((rawNpcs as { list: Array<{ id: string; stance: string; faction: string; kind: string }> }).list)
            : [];
          if (spec === 'self') return [npcId];
          if (spec === 'ally') {
            if (explicitId) {
              const f = metaList.find((m) => m.id === explicitId)?.faction ?? '';
              return f && f === meFaction ? [explicitId] : [npcId];
            }
            return [npcId];
          }
          if (spec === 'area') {
            return npcs.filter((n) => n.stance === 'engage' && (n.faction !== meFaction || n.kind === 'enemy' || n.kind === 'boss')).map((n) => n.id);
          }
          // 'enemy' or default
          if (explicitId) return [explicitId];
          // fallback: highest aggro
          const targetByAggro = Array.from(state.aggro.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
          return targetByAggro ? [targetByAggro] : [];
        };
        // Effects loop (multi-apply)
        const events: Array<{ type: 'damage' | 'status'; fromId?: string; toId: string; amount?: number; kind?: string; status?: string }> = [];
        const effects: AbilityEffect[] = ability?.effects && ability.effects.length
          ? ability.effects
          : (kind === 'attack'
            ? [{ kind: 'damage', power: ability?.power }]
            : kind === 'taunt'
              ? [{ kind: 'taunt', durationMs: cdMs }]
              : [{ kind: 'heal', power: ability?.power }]);
        for (const eff of effects) {
          const specTargets = resolveTargets(ability?.target ?? 'enemy', targetId);
          for (const tid of specTargets) {
            if (eff.kind === 'damage') {
              const damageKind = eff.damageKind ?? kind;
              const def = actors.getAll().find((a) => a.id === tid);
              if (!def) continue;
              const dmg = computeDamage({ attackerDerived: attacker.derived ?? undefined, defenderResists: def.modifiers?.resists ?? {}, defenderStatusTags: def.status ?? [], ability: { kind: damageKind, power: eff.power ?? ability?.power ?? 5 } });
              actors.hpAdd(tid, -dmg);
              events.push({ type: 'damage', fromId: npcId, toId: tid, amount: dmg, kind: damageKind });
              addAggroToEnemies(npcId, Math.max(1, dmg), true);
            } else if (eff.kind === 'heal') {
              const heal = Math.max(1, Math.floor(eff.power ?? ability?.power ?? 5));
              actors.hpAdd(tid, heal);
              events.push({ type: 'status', fromId: npcId, toId: tid, status: 'heal', amount: heal });
              addAggroToEnemies(npcId, Math.ceil(heal / 2), true);
            } else if (eff.kind === 'taunt') {
              tauntEnemies(npcId, Math.max(1000, eff.durationMs ?? cdMs), true);
              applyStatus(tid, 'taunted', Math.max(1000, eff.durationMs ?? cdMs));
              events.push({ type: 'status', fromId: npcId, toId: tid, status: 'taunt' });
            } else if (eff.kind === 'buff' || eff.kind === 'debuff') {
              applyStatus(tid, eff.statusTag, eff.durationMs);
              events.push({ type: 'status', fromId: npcId, toId: tid, status: eff.statusTag });
            }
          }
        }
        state.cooldowns[abilityId] = Date.now() + cdMs;
        if (events.length > 0) {
          context.router.sendLobbyMessage('npc:combat:result', { npcId, events }, 'npc:combat:apply');
        }
      }
    }
  ]
});

registerSyncModel(npcControl);
try { startNpcTickScheduler(); } catch {}
