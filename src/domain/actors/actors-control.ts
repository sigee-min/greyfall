import { defineSyncModel, registerSyncModel } from '../net-objects/index.js';
import { getHostObject } from '../net-objects/registry.js';
import { WORLD_ACTORS_OBJECT_ID, WORLD_POSITIONS_OBJECT_ID } from '../net-objects/object-ids.js';
import { HostWorldActorsObject } from '../net-objects/world-actors-host.js';
import { HostWorldPositionsObject } from '../net-objects/world-positions-host.js';
import { requestAICommand } from '../ai/ai-gateway';
import { CHAT_OBJECT_ID, type ChatEntry } from '../net-objects/chat.js';
import type { HostObject } from '../net-objects/types';

type VoidState = null;

const actorsControl = defineSyncModel<VoidState>({
  id: 'actors:control',
  initial: () => null,
  requestOnStart: false,
  commands: [
    {
      kind: 'actors:hpAdd:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { actorId, delta } = body as { actorId?: unknown; delta?: unknown };
        if (typeof actorId !== 'string') return null;
        const d = typeof delta === 'number' ? Math.max(-20, Math.min(20, Math.floor(delta))) : 0;
        if (!d) return null;
        return { actorId, delta: d };
      },
      handle: ({ payload }) => {
        const { actorId, delta } = payload as { actorId: string; delta: number };
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        actors?.ensure(actorId);
        actors?.hpAdd(actorId, delta);
        // Optional: narrate minor heal
        void narrateEffects([`p:${actorId} hp.add ${delta} (by system)`]);
      }
    },
    {
      kind: 'actors:inventory:transfer:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { fromId, toId, key, count } = body as { fromId?: unknown; toId?: unknown; key?: unknown; count?: unknown };
        if (typeof fromId !== 'string' || typeof toId !== 'string' || typeof key !== 'string') return null;
        const c = typeof count === 'number' ? Math.max(1, Math.min(99, Math.floor(count))) : 1;
        return { fromId, toId, key, count: c };
      },
      handle: ({ payload }) => {
        const { fromId, toId, key, count } = payload as { fromId: string; toId: string; key: string; count: number };
        // Basic validation: same field required
        const positions = getHostObject<HostWorldPositionsObject>(WORLD_POSITIONS_OBJECT_ID);
        const list = positions?.getList() ?? [];
        const pf = list.find((e) => e.id === fromId);
        const pt = list.find((e) => e.id === toId);
        if (!pf || !pt) return;
        if (!(pf.mapId === pt.mapId && pf.fieldId === pt.fieldId)) return;
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        actors?.ensure(fromId);
        actors?.ensure(toId);
        const ok = actors?.transferItem(fromId, toId, key, count);
        if (ok) void narrateEffects([`item.transfer ${key} from p:${fromId} to p:${toId}`]);
      }
    },
    {
      kind: 'actors:equip:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { actorId, key } = body as { actorId?: unknown; key?: unknown };
        if (typeof actorId !== 'string' || typeof key !== 'string') return null;
        return { actorId, key };
      },
      handle: ({ payload }) => {
        const { actorId, key } = payload as { actorId: string; key: string };
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        actors?.ensure(actorId);
        const ok = actors?.equipItem(actorId, key);
        if (ok) void narrateEffects([`equip p:${actorId} ${key}`]);
      }
    },
    {
      kind: 'actors:unequip:request',
      parse: (body: unknown) => {
        if (!body || typeof body !== 'object') return null;
        const { actorId, key } = body as { actorId?: unknown; key?: unknown };
        if (typeof actorId !== 'string' || typeof key !== 'string') return null;
        return { actorId, key };
      },
      handle: ({ payload }) => {
        const { actorId, key } = payload as { actorId: string; key: string };
        const actors = getHostObject<HostWorldActorsObject>(WORLD_ACTORS_OBJECT_ID);
        actors?.ensure(actorId);
        const ok = actors?.unequipItem(actorId, key);
        if (ok) void narrateEffects([`unequip p:${actorId} ${key}`]);
      }
    }
  ]
});

registerSyncModel(actorsControl);

async function narrateEffects(effects: string[]) {
  try {
    const resp = await requestAICommand({
      manager: 'smart',
      requestType: 'result.narrate',
      actorId: 'system',
      userInstruction: '',
      sections: { effects },
      persona: '너는 Greyfall TRPG 게임 매니저이다. 간결하게 결과를 서술한다.',
      locale: 'ko',
      temperature: 0.3,
      maxTokens: 160,
      fallbackChatText: '행동이 반영되었습니다.'
    });
    const bodyText = String(resp.body ?? '').trim() || '행동이 반영되었습니다.';
    const chat = getHostObject<{ append: (entry: ChatEntry, context?: string) => void } & HostObject>(CHAT_OBJECT_ID);
    if (!chat) return;
    const entry = {
      id: newId(),
      authorId: 'assistant',
      authorName: 'Assistant',
      authorTag: '#LLM',
      authorRole: 'guest' as const,
      body: bodyText,
      at: Date.now()
    };
    chat.append(entry, 'actors:narrate');
  } catch (e) {
    // no-op
  }
}

function newId(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c && 'randomUUID' in c) return (c as Crypto & { randomUUID: () => string }).randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
