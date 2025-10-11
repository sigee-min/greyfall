import { defineSyncModel, registerSyncModel } from '../net-objects/sync-model.js';
import { getHostObject } from '../net-objects/registry.js';
import { WORLD_ACTORS_OBJECT_ID } from '../net-objects/object-ids.js';
import type { HostWorldActorsObject } from '../net-objects/world-actors-host.js';
import { computeDamage } from '../combat/damage';

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
      handle: ({ payload, context }) => {
        const { npcId, fromId, text } = payload as { npcId: string; fromId: string; text: string };
        // Placeholder pipeline: echo-style polite reply
        const reply = text.length > 0 ? `(${npcId}) 알았다. ${fromId}.` : '...';
        context.router.sendLobbyMessage('npc:chat:result', { npcId, toId: fromId, text: reply }, 'npc:chat:result');
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
