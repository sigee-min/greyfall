import { defineSyncModel, registerSyncModel } from '../net-objects/index.js';
import { getHostObject } from '../net-objects/registry.js';
import { WORLD_ACTORS_OBJECT_ID, WORLD_POSITIONS_OBJECT_ID } from '../net-objects/object-ids.js';
import { requestAICommand } from '../ai/ai-gateway';
import { CHAT_OBJECT_ID } from '../net-objects/chat.js';
const actorsControl = defineSyncModel({
    id: 'actors:control',
    initial: () => null,
    requestOnStart: false,
    commands: [
        {
            kind: 'actors:hpAdd:request',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { actorId, delta } = body;
                if (typeof actorId !== 'string')
                    return null;
                const d = typeof delta === 'number' ? Math.max(-20, Math.min(20, Math.floor(delta))) : 0;
                if (!d)
                    return null;
                return { actorId, delta: d };
            },
            handle: ({ payload }) => {
                const { actorId, delta } = payload;
                const actors = getHostObject(WORLD_ACTORS_OBJECT_ID);
                actors?.ensure(actorId);
                actors?.hpAdd(actorId, delta);
                // Optional: narrate minor heal
                void narrateEffects([`p:${actorId} hp.add ${delta} (by system)`]);
            }
        },
        {
            kind: 'actors:inventory:transfer:request',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { fromId, toId, key, count } = body;
                if (typeof fromId !== 'string' || typeof toId !== 'string' || typeof key !== 'string')
                    return null;
                const c = typeof count === 'number' ? Math.max(1, Math.min(99, Math.floor(count))) : 1;
                return { fromId, toId, key, count: c };
            },
            handle: ({ payload }) => {
                const { fromId, toId, key, count } = payload;
                // Basic validation: same field required
                const positions = getHostObject(WORLD_POSITIONS_OBJECT_ID);
                const list = positions?.getList() ?? [];
                const pf = list.find((e) => e.id === fromId);
                const pt = list.find((e) => e.id === toId);
                if (!pf || !pt)
                    return;
                if (!(pf.mapId === pt.mapId && pf.fieldId === pt.fieldId))
                    return;
                const actors = getHostObject(WORLD_ACTORS_OBJECT_ID);
                actors?.ensure(fromId);
                actors?.ensure(toId);
                const ok = actors?.transferItem(fromId, toId, key, count);
                if (ok)
                    void narrateEffects([`item.transfer ${key} from p:${fromId} to p:${toId}`]);
            }
        },
        {
            kind: 'actors:equip:request',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { actorId, key } = body;
                if (typeof actorId !== 'string' || typeof key !== 'string')
                    return null;
                return { actorId, key };
            },
            handle: ({ payload }) => {
                const { actorId, key } = payload;
                const actors = getHostObject(WORLD_ACTORS_OBJECT_ID);
                actors?.ensure(actorId);
                const ok = actors?.equipItem(actorId, key);
                if (ok)
                    void narrateEffects([`equip p:${actorId} ${key}`]);
            }
        },
        {
            kind: 'actors:unequip:request',
            parse: (body) => {
                if (!body || typeof body !== 'object')
                    return null;
                const { actorId, key } = body;
                if (typeof actorId !== 'string' || typeof key !== 'string')
                    return null;
                return { actorId, key };
            },
            handle: ({ payload }) => {
                const { actorId, key } = payload;
                const actors = getHostObject(WORLD_ACTORS_OBJECT_ID);
                actors?.ensure(actorId);
                const ok = actors?.unequipItem(actorId, key);
                if (ok)
                    void narrateEffects([`unequip p:${actorId} ${key}`]);
            }
        }
    ]
});
registerSyncModel(actorsControl);
async function narrateEffects(effects) {
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
        const chat = getHostObject(CHAT_OBJECT_ID);
        if (!chat)
            return;
        const entry = {
            id: newId(),
            authorId: 'assistant',
            authorName: 'Assistant',
            authorTag: '#LLM',
            authorRole: 'guest',
            body: bodyText,
            at: Date.now()
        };
        chat.append(entry, 'actors:narrate');
    }
    catch {
        // no-op
    }
}
function newId() {
    try {
        const c = globalThis.crypto;
        if (c && 'randomUUID' in c)
            return c.randomUUID();
    }
    catch { }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
