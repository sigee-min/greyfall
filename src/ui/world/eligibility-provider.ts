import type { SessionParticipant } from '../../domain/session/types';
import type { PositionEntry } from '../../domain/net-objects/world-positions-client';
import type { EligibilityInput, InventoryMap } from '../../domain/ai/gateway/eligibility';

export type BuildEligibilityOptions = {
  requesterParticipantId: string;
  participants: SessionParticipant[];
  positions: PositionEntry[];
  rules?: { sameFieldRequiredForHeal?: boolean; sameFieldRequiredForGive?: boolean };
  inventoryByParticipant?: Record<string, { key: string; count: number }[]>; // participantId → items
};

export function buildEligibilityFromSession(opts: BuildEligibilityOptions): EligibilityInput {
  const { requesterParticipantId, participants, positions, rules, inventoryByParticipant } = opts;
  const posById = new Map(positions.map((p) => [p.id, p]));
  const actors = participants.map((p) => {
    const pos = posById.get(p.id) ?? null;
    return {
      id: `p:${p.id}`,
      role: 'player' as const,
      name: p.name,
      hp: undefined,
      status: [],
      mapId: pos?.mapId,
      fieldId: pos?.fieldId
    };
  });
  const inventory: InventoryMap | undefined = inventoryByParticipant
    ? Object.fromEntries(Object.entries(inventoryByParticipant).map(([pid, items]) => [`p:${pid}`, items]))
    : undefined;
  return {
    requesterActorId: `p:${requesterParticipantId}`,
    actors,
    inventory,
    rules
  };
}

