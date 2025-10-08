import { useEffect, useMemo, useRef } from 'react';
import type { LlmManagerKind } from '../../../llm/llm-engine';
import type { RegisterLobbyHandler, PublishLobbyMessage } from '../../chat/use-lobby-chat';
import type { SessionParticipant } from '../../session/types';
import { executeAICommand } from '../ai-router';
import { requestAICommand } from '../ai-gateway';
import { worldPositionsClient } from '../../net-objects/world-positions-client';
import { worldActorsClient } from '../../net-objects/world-actors-client';
import { resolveItemAlias } from '../../world/item-alias';
import type { EligibilityInput } from './eligibility';
import { useLobbyCharacterSync } from '../../character/hooks/use-character-sync';
import type { CharacterLoadout } from '../../character/types';

export type GuideAgentPolicy = {
  respondOnMention: boolean;
  mentionAliases?: string[];
  cooldownMs: number;
  maxContext: number;
  maxTokens: number;
};

export type UseGuideAgentOptions = {
  enabled: boolean;
  manager: LlmManagerKind;
  registerLobbyHandler: RegisterLobbyHandler;
  publishLobbyMessage: PublishLobbyMessage;
  localParticipantId: string | null;
  participants: SessionParticipant[];
  locale?: 'ko' | 'en';
  policy?: Partial<GuideAgentPolicy>;
};

export function useGuideAgent({
  enabled,
  manager,
  registerLobbyHandler,
  publishLobbyMessage,
  localParticipantId,
  participants: _participants,
  locale = 'ko',
  policy
}: UseGuideAgentOptions) {
  const guideName = useMemo(() => '게임 매니저', []);
  const authorId = useMemo(() => (localParticipantId ? `guide:${localParticipantId}` : 'guide:host'), [localParticipantId]);
  const fullPolicy: GuideAgentPolicy = useMemo(
    () => ({
      respondOnMention: true,
      mentionAliases: ['게임 매니저', '매니저', '안내인', '가이드', 'guide', 'bot'],
      cooldownMs: 3500,
      maxContext: 8,
      maxTokens: 120,
      ...policy
    }),
    [policy]
  );

  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const lastAtRef = useRef(0);
  const pendingRef = useRef<Promise<void> | null>(null);
  const charSync = useLobbyCharacterSync({ localParticipantId });

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = registerLobbyHandler('chat', async (message) => {
      const entry = message.body.entry;
      const who = `${entry.authorName}`;
      const line = `${who}: ${entry.body}`;
      const isFromAgent = entry.authorId === authorId;
      if (!isFromAgent) {
        pushHistory(historyRef, { role: 'user', content: line }, fullPolicy.maxContext);
      }

      if (!shouldReply(entry.body, guideName, fullPolicy)) return;

      const now = Date.now();
      if (now - lastAtRef.current < fullPolicy.cooldownMs) return;
      if (pendingRef.current) return;

      pendingRef.current = (async () => {
        try {
          const context = historyRef.current
            .slice(-fullPolicy.maxContext)
            .map((m) => `- ${m.role === 'assistant' ? '(게임 매니저) ' : ''}${m.content}`)
            .join('\n');
          // 1) Try structured intent.plan using live eligibility
          const requesterId = entry.authorId; // participant id
          const elig = buildEligibilityFromLiveState(requesterId, _participants, charSync.byId);
            const planResp = await requestAICommand({
              manager,
              actorId: `p:${requesterId}`,
              requestType: 'intent.plan',
              persona: `${guideName}는 Greyfall TRPG 게임 매니저다.`,
              userInstruction: entry.body,
              contextText: context,
              eligibility: elig,
              locale,
              temperature: 0.2,
              maxTokens: 280,
              fallbackChatText: ''
            });
          const planText = String(planResp.body ?? '').trim();
          let plan: { action?: string; targets?: string[]; item?: string } = {};
          try { plan = JSON.parse(planText); } catch {}

          const target = Array.isArray(plan.targets) && plan.targets[0] ? String(plan.targets[0]) : null; // 'p:bravo'
          const toPid = target && target.startsWith('p:') ? target.slice(2) : target;
      const effects: string[] = [];
          let applied = false;
          if (plan.action === 'heal' && toPid) {
            publishLobbyMessage('actors:hpAdd:request', { actorId: toPid, delta: 3 }, 'ai:plan');
            applied = true;
            effects.push(`${target} hp.add 3 (by p:${requesterId})`);
          } else if (plan.action === 'item.give' && toPid && typeof plan.item === 'string' && plan.item.trim()) {
            const key = resolveItemAlias(plan.item.trim(), (worldActorsClient.getFor(requesterId)?.inventory ?? []).map((i) => i.key));
            publishLobbyMessage('actors:inventory:transfer:request', { fromId: requesterId, toId: toPid, key, count: 1 }, 'ai:plan');
            applied = true;
            effects.push(`item.transfer ${key} from p:${requesterId} to ${target}`);
          } else if (plan.action === 'equip' && typeof plan.item === 'string' && plan.item.trim()) {
            const key = resolveItemAlias(plan.item.trim(), (worldActorsClient.getFor(requesterId)?.inventory ?? []).map((i) => i.key));
            publishLobbyMessage('actors:equip:request', { actorId: requesterId, key }, 'ai:plan');
            applied = true;
            effects.push(`equip p:${requesterId} ${key}`);
          } else if (plan.action === 'unequip' && typeof plan.item === 'string' && plan.item.trim()) {
            const key = resolveItemAlias(plan.item.trim(), (worldActorsClient.getFor(requesterId)?.inventory ?? []).map((i) => i.key));
            publishLobbyMessage('actors:unequip:request', { actorId: requesterId, key }, 'ai:plan');
            applied = true;
            effects.push(`unequip p:${requesterId} ${key}`);
          }

          if (!applied) {
            // 2) Fallback to plain chat
            const prompt = [
              `${guideName}로서 아래 플레이어 발언에 응답해 주세요.`,
              `플레이어 발언: ${entry.body}`
            ].join('\n\n');
            const parsed = await requestAICommand({
              manager,
              actorId: authorId,
              requestType: 'chat',
              persona: `${guideName}는 Greyfall TRPG 게임 매니저다. 친근하게 말한다.`,
              userInstruction: prompt,
              contextText: context,
              locale,
              temperature: 0.4,
              maxTokens: fullPolicy.maxTokens,
              fallbackChatText: '요청하신 내용을 이해하지 못했습니다.'
            });
            const executed = await executeAICommand(parsed, {
              manager,
              publishLobbyMessage,
              participants: _participants,
              localParticipantId
            });
            const bodyText = typeof parsed.body === 'string' ? parsed.body : JSON.stringify(parsed.body);
            if (executed && bodyText) {
              pushHistory(historyRef, { role: 'assistant', content: `${guideName}: ${bodyText}` }, fullPolicy.maxContext);
              lastAtRef.current = Date.now();
            }
          } else {
            // 3) Generate brief narration from Effects
            try {
              const narr = await requestAICommand({
                manager,
                actorId: authorId,
                requestType: 'result.narrate',
                persona: `${guideName}는 Greyfall TRPG 게임 매니저다. 친근하게 말한다.`,
                userInstruction: '',
                sections: { effects },
                locale,
                temperature: 0.4,
                maxTokens: fullPolicy.maxTokens,
                fallbackChatText: '행동이 반영되었습니다.'
              });
              const text = String(narr.body ?? '').trim() || '행동이 반영되었습니다.';
              publishLobbyMessage('chat:append:request', { body: text, authorId: authorId }, 'ai:narrate');
              pushHistory(historyRef, { role: 'assistant', content: `${guideName}: ${text}` }, fullPolicy.maxContext);
              lastAtRef.current = Date.now();
            } catch {
              const text = '행동이 반영되었습니다.';
              publishLobbyMessage('chat:append:request', { body: text, authorId: authorId }, 'ai:narrate');
              pushHistory(historyRef, { role: 'assistant', content: `${guideName}: ${text}` }, fullPolicy.maxContext);
              lastAtRef.current = Date.now();
            }
          }
        } catch (err) {
          console.warn('[guide] generate reply failed', err);
        } finally {
          pendingRef.current = null;
        }
      })();
    });
    return unsubscribe;
  }, [authorId, enabled, fullPolicy, guideName, publishLobbyMessage, registerLobbyHandler, _participants, localParticipantId, manager, locale]);
}

function pushHistory(ref: { current: { role: 'user' | 'assistant'; content: string }[] }, item: { role: 'user' | 'assistant'; content: string }, max: number) {
  ref.current = [...ref.current, item].slice(-max);
}

function shouldReply(text: string, name: string, policy: GuideAgentPolicy): boolean {
  if (!policy.respondOnMention) return false;
  const t = text.toLowerCase();
  const nameLc = name.toLowerCase();
  if (t.includes(nameLc)) return true;
  if (t.includes('@' + nameLc)) return true;
  for (const alias of policy.mentionAliases ?? []) {
    const a = alias.toLowerCase();
    if (t.includes(a) || t.includes('@' + a)) return true;
  }
  return false;
}

function buildEligibilityFromLiveState(
  requesterParticipantId: string,
  participants: SessionParticipant[],
  loadoutsById?: Record<string, CharacterLoadout>
): EligibilityInput {
  const positions = worldPositionsClient.getAll();
  const posById = new Map(positions.map((p) => [p.id, p]));
  const actorsState = worldActorsClient.getAll() as Array<{ id: string; hp?: { cur: number; max: number }; status?: string[]; inventory?: { key: string; count: number }[] }>;
  const invMap: Record<string, { key: string; count: number }[]> = {};
  if (Array.isArray(actorsState)) {
    for (const a of actorsState) {
      if (Array.isArray(a.inventory) && a.inventory.length) invMap[`p:${a.id}`] = a.inventory.map((i) => ({ key: String(i.key), count: Math.max(0, Math.floor(i.count || 0)) }));
    }
  }
  const actors = participants.map((p) => {
    const pos = posById.get(p.id) ?? null;
    const stats = actorsState?.find((a) => a.id === p.id) ?? null;
    const lo = loadoutsById?.[p.id];
    const passiveIds = lo?.passives?.map((x) => x.id) ?? [];
    const traitNames = lo?.traits?.map((t) => t.name) ?? [];
    return {
      id: `p:${p.id}`,
      role: 'player' as const,
      name: p.name,
      hp: stats?.hp,
      status: stats?.status,
      mapId: pos?.mapId,
      fieldId: pos?.fieldId
    };
  });
  const elig: EligibilityInput = {
    requesterActorId: `p:${requesterParticipantId}`,
    actors,
    inventory: Object.keys(invMap).length ? invMap : undefined,
    rules: { sameFieldRequiredForGive: true, sameFieldRequiredForHeal: true }
  };
  // Encode requester's traits/passives into requester line by appending labels
  const reqLoadout = loadoutsById?.[requesterParticipantId];
  if (reqLoadout) {
    const traitsLabel = reqLoadout.traits.map((t) => t.name).join(', ');
    const passivesLabel = reqLoadout.passives.map((p) => p.id).join(', ');
    const selfIdx = elig.actors?.findIndex((a) => a.id === `p:${requesterParticipantId}`) ?? -1;
    if (selfIdx >= 0) {
      // augment name with compact traits/passives marker via status for minimal intrusion
      const a = elig.actors![selfIdx] as any;
      const meta: string[] = [];
      if (traitsLabel) meta.push(`traits=[${traitsLabel}]`);
      if (passivesLabel) meta.push(`passives=[${passivesLabel}]`);
      if (meta.length) {
        a.status = Array.isArray(a.status) ? [...a.status, ...meta] : meta;
      }
    }
  }
  return elig;
}

// resolveItemKey is now centralised in item-alias.ts
