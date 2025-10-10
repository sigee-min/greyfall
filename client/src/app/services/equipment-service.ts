import { readActor } from '../adapters/net-actors-adapter';
import { itemSlot, slotCapacity } from '../../domain/world/equipment-rules';
import { getMissionState } from '../../domain/mission/state';
import { DEFAULT_MISSION_POLICY, EQUIP_COOLDOWN_MS } from '../../domain/equipment/policy';

export type CanEquipReason = 'slot-capacity' | 'unavailable' | 'combat-restricted' | 'cooldown' | 'duplicate';
export type CanEquipResult = { allowed: true } | { allowed: false; reason: CanEquipReason };

export function canEquipSlotOnly(actorId: string | null, itemKey: string): CanEquipResult {
  if (!actorId) return { allowed: false, reason: 'unavailable' } as const;
  const actor = readActor(actorId);
  if (!actor) return { allowed: false, reason: 'unavailable' } as const;
  // Combat restriction
  const ms = getMissionState();
  const policy = DEFAULT_MISSION_POLICY[ms];
  if (!policy.canEquip) return { allowed: false, reason: 'combat-restricted' } as const;
  const slot = itemSlot(itemKey);
  const cap = slotCapacity(slot);
  const equipped = Array.isArray(actor.equipment) ? actor.equipment : [];
  const used = equipped.filter((k) => itemSlot(k) === slot).length;
  if (used >= cap) return { allowed: false, reason: 'slot-capacity' } as const;
  return { allowed: true } as const;
}

const LAST_EQUIP_AT = new Map<string, number>(); // per actor cooldown mirror (client-side UX)
const PENDING_KEYS = new Map<string, number>(); // idempotency window (actorId+itemKey)

export function canEquip(actorId: string | null, itemKey: string, opts?: { idempotencyKey?: string }): CanEquipResult {
  const base = canEquipSlotOnly(actorId, itemKey);
  if (!base.allowed) return base;
  const id = String(actorId);
  // Inventory availability quick check
  const actor = readActor(id);
  const have = (actor?.inventory ?? []).find((i) => i.key === itemKey)?.count ?? 0;
  if (have <= 0) return { allowed: false, reason: 'unavailable' } as const;
  // Client-side cooldown mirror (soft UX guard)
  const now = Date.now();
  const last = LAST_EQUIP_AT.get(id) ?? 0;
  if (now - last < EQUIP_COOLDOWN_MS) return { allowed: false, reason: 'cooldown' } as const;
  // Simple duplicate suppression
  const key = `${id}::${itemKey}::${opts?.idempotencyKey || ''}`;
  const until = PENDING_KEYS.get(key) ?? 0;
  if (until && until > now) return { allowed: false, reason: 'duplicate' } as const;
  // Record TTL ~ 1.2x cooldown
  PENDING_KEYS.set(key, now + Math.max(600, Math.floor(EQUIP_COOLDOWN_MS * 1.2)));
  LAST_EQUIP_AT.set(id, now);
  return { allowed: true } as const;
}
