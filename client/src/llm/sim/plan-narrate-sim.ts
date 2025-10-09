import { requestAICommand } from '../../domain/ai/ai-gateway';
import type { AIGatewayParams } from '../../domain/ai/gateway/types';
import type { EligibilityInput } from '../../domain/ai/gateway/eligibility';

export type SimOptions = {
  manager?: 'fast' | 'smart';
  actorId: string; // e.g., p:alice
  userInstruction: string;
  eligibility: EligibilityInput;
  persona?: string;
  locale?: 'ko' | 'en';
  healAmount?: number; // default 3
};

export type SimResult = {
  planJson: string;
  rolls: string[];
  effects: string[];
  narration: string;
};

function sameField(mapA?: string | null, fieldA?: string | null, mapB?: string | null, fieldB?: string | null): boolean {
  return Boolean(mapA && mapB && fieldA && fieldB && mapA === mapB && fieldA === fieldB);
}

export async function simulatePlanNarrate(opts: SimOptions): Promise<SimResult> {
  const manager = opts.manager ?? 'smart';
  const persona = opts.persona ?? '너는 Greyfall 게임 매니저이다.';
  const locale = opts.locale ?? 'ko';
  const healAmount = Math.max(1, Math.min(10, Math.floor(opts.healAmount ?? 3)));

  // 1) intent.plan
  const planParams: AIGatewayParams = {
    manager,
    requestType: 'intent.plan',
    actorId: opts.actorId,
    userInstruction: opts.userInstruction,
    eligibility: opts.eligibility,
    persona,
    locale
  } as const;
  const planResp = await requestAICommand(planParams);
  const planText = String(planResp.body ?? '').trim();
  let plan: { action?: string; targets?: string[]; item?: string } = {};
  try { plan = JSON.parse(planText); } catch {}

  // 2) apply (code-side effects)
  const rolls: string[] = [];
  const effects: string[] = [];
  const self = opts.eligibility.actors.find((a) => a.id === opts.actorId) ?? null;
  const targetId = Array.isArray(plan.targets) && plan.targets[0] ? String(plan.targets[0]) : null;
  const target = targetId ? (opts.eligibility.actors.find((a) => a.id === targetId) ?? null) : null;

  if (plan.action === 'heal' && self && target) {
    const reqSame = opts.eligibility.rules?.sameFieldRequiredForHeal ?? true;
    if (!reqSame || sameField(self.mapId, self.fieldId, target.mapId, target.fieldId)) {
      effects.push(`${target.id} hp.add ${healAmount} (by ${self.id})`);
    }
  } else if (plan.action === 'item.give' && self && target && plan.item) {
    const reqSame = opts.eligibility.rules?.sameFieldRequiredForGive ?? true;
    if (!reqSame || sameField(self.mapId, self.fieldId, target.mapId, target.fieldId)) {
      effects.push(`item.transfer ${plan.item} from ${self.id} to ${target.id}`);
    }
  } else {
    // Optional: simple stealth roll when action is sneak_move
    if (plan.action === 'sneak_move' && self) {
      const r = Math.ceil(Math.random() * 20);
      const total = r; // no modifier in sim
      const pass = total >= 11;
      rolls.push(`stealth d20+0 vs DC=11 → ${total} (${pass ? 'pass' : 'fail'})`);
    }
  }

  // 3) result.narrate (feed Rolls/Effects back)
  const sections = {
    rolls: rolls.length ? rolls : undefined,
    effects: effects.length ? effects : undefined
  };
  const narrParams: AIGatewayParams = {
    manager,
    requestType: 'result.narrate',
    actorId: opts.actorId,
    userInstruction: '',
    sections,
    persona,
    locale
  } as const;
  const narrResp = await requestAICommand(narrParams);
  const narration = String(narrResp.body ?? '').trim();

  return { planJson: planText, rolls, effects, narration };
}
