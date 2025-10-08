import { ACTION_SET, CHECK_SET, HAZARD_SET, inSet, clampArray } from '../spec/whitelist';
import { isActorId, limitText } from '../spec/patterns';
import type { PlanOutput, PlanValidation } from '../spec/types';

export type PlanValidatorOptions = {
  maxChecks?: number;
  maxHazards?: number;
  maxTargets?: number;
  allowItem?: boolean;
};

const DEFAULTS: Required<PlanValidatorOptions> = {
  maxChecks: 2,
  maxHazards: 2,
  maxTargets: 2,
  allowItem: true
};

export function validatePlanOutput(rawText: string, opts?: PlanValidatorOptions): PlanValidation {
  const p = { ...DEFAULTS, ...(opts ?? {}) } as Required<PlanValidatorOptions>;
  let obj: unknown = null;
  const trimmed = String(rawText ?? '').trim();
  if (!trimmed) return { ok: false, error: 'empty' };
  try {
    obj = JSON.parse(trimmed) as unknown;
  } catch (e) {
    return { ok: false, error: 'invalid_json' };
  }
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'not_object' };
  const o = obj as Record<string, unknown>;
  const actionIn = typeof o.action === 'string' ? o.action.toLowerCase() : '';
  const action = inSet(ACTION_SET, actionIn) ? actionIn : 'no_action';

  const checksIn = Array.isArray(o.checks) ? (o.checks as unknown[]).map(String) : [];
  const hazardsIn = Array.isArray(o.hazards) ? (o.hazards as unknown[]).map(String) : [];
  const targetsIn = Array.isArray(o.targets) ? (o.targets as unknown[]).map(String) : [];

  const checks = clampArray(
    checksIn.filter((c) => inSet(CHECK_SET, String(c).toLowerCase())),
    p.maxChecks
  );
  const hazards = clampArray(
    hazardsIn.filter((h) => inSet(HAZARD_SET, String(h).toLowerCase())),
    p.maxHazards
  );
  const targets = clampArray(
    targetsIn.filter((t) => isActorId(t)),
    p.maxTargets
  );

  const item = p.allowItem && typeof o.item === 'string' ? limitText(o.item, 40) ?? undefined : undefined;
  const reason = (() => {
    const meta = o.meta && typeof o.meta === 'object' ? (o.meta as Record<string, unknown>) : null;
    return meta && typeof meta.reason === 'string' ? limitText(meta.reason, 40) ?? undefined : undefined;
  })();

  const fixed: PlanOutput = { action };
  if (checks.length) fixed.checks = checks;
  if (hazards.length) fixed.hazards = hazards;
  if (targets.length) fixed.targets = targets;
  if (item) fixed.item = item;
  if (reason) fixed.meta = { reason };

  return { ok: true, fixed };
}

