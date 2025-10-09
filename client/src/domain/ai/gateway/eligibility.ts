import type { SectionBundle } from '../../../llm/spec/prompts';

export type ActorSnapshot = {
  id: string; // e.g., p:alice
  role?: 'player' | 'enemy' | 'ally' | 'neutral';
  name?: string;
  hp?: { cur: number; max: number };
  status?: string[];
  mapId?: string;
  fieldId?: string;
  pos?: { x: number; y: number };
};

export type InventoryMap = Record<string, { key: string; count: number }[]>; // actorId → items

export type EligibilityInput = {
  requesterActorId: string;
  actors: ActorSnapshot[];
  inventory?: InventoryMap;
  rules?: { sameFieldRequiredForHeal?: boolean; sameFieldRequiredForGive?: boolean };
};

function lineActors(a: ActorSnapshot): string {
  const hp = a.hp ? ` hp=${a.hp.cur}/${a.hp.max}` : '';
  const role = a.role ? ` role=${a.role}` : '';
  const name = a.name ? ` name=${a.name}` : '';
  const status = a.status && a.status.length ? ` status=[${a.status.join(',')}]` : ' status=[]';
  return `${a.id}${role}${name}${hp}${status}`.trim();
}

function linePosition(a: ActorSnapshot): string | null {
  const map = a.mapId ? ` map=${a.mapId}` : '';
  const field = a.fieldId ? ` field=${a.fieldId}` : '';
  const pos = a.pos ? ` pos=${a.pos.x},${a.pos.y}` : '';
  if (!map && !field && !pos) return null;
  return `${a.id}${map}${field}${pos}`.trim();
}

function sameField(a: ActorSnapshot | undefined, b: ActorSnapshot | undefined): boolean {
  if (!a || !b) return false;
  return Boolean(
    a.mapId &&
      b.mapId &&
      a.fieldId &&
      b.fieldId &&
      a.mapId === b.mapId &&
      a.fieldId === b.fieldId
  );
}

export function buildEligibilitySections(input: EligibilityInput): SectionBundle {
  const { requesterActorId, actors, inventory, rules } = input;
  const sections: SectionBundle = {};

  // Requester snapshot
  const self = actors.find((x) => x.id === requesterActorId);
  if (self) {
    const hp = self.hp ? ` hp=${self.hp.cur}/${self.hp.max}` : '';
    const role = self.role ? ` role=${self.role}` : '';
    const status = self.status && self.status.length ? ` status=[${self.status.join(',')}]` : ' status=[]';
    sections.requester = `actor=${self.id} (self)${role}${hp}${status}`;
  } else {
    sections.requester = `actor=${requesterActorId} (self)`;
  }

  // Actors list
  sections.actors = actors.map(lineActors);

  // Positions
  const posLines = actors.map(linePosition).filter((l): l is string => Boolean(l));
  if (posLines.length) sections.positions = posLines;

  // Rules
  const ruleLines: string[] = [];
  if (rules?.sameFieldRequiredForHeal) ruleLines.push('same_field_required_for_heal=true');
  if (rules?.sameFieldRequiredForGive) ruleLines.push('same_field_required_for_give=true');
  if (ruleLines.length) sections.rules = ruleLines;

  // Inventory
  if (inventory) {
    const invLines: string[] = [];
    for (const [actorId, items] of Object.entries(inventory)) {
      if (!items || items.length === 0) continue;
      const body = items.map((it) => `${it.key}(${Math.max(0, Math.floor(it.count || 0))})`).join(', ');
      invLines.push(`${actorId} items=[${body}]`);
    }
    if (invLines.length) sections.inventory = invLines;
  }

  // Eligible targets (heal / item.give)
  const healTargets: string[] = [];
  const giveTargets: string[] = [];
  for (const a of actors) {
    if (a.id === requesterActorId) continue;
    if (rules?.sameFieldRequiredForHeal) {
      if (!sameField(self, a)) continue;
    }
    healTargets.push(a.id);
  }
  for (const a of actors) {
    if (a.id === requesterActorId) continue;
    if (rules?.sameFieldRequiredForGive) {
      if (!sameField(self, a)) continue;
    }
    giveTargets.push(a.id);
  }
  const targetLines: string[] = [];
  if (healTargets.length) targetLines.push(`heal:[${healTargets.join(',')}]`);
  if (giveTargets.length) targetLines.push(`item.give:[${giveTargets.join(',')}]`);
  if (targetLines.length) sections.targetsEligible = targetLines;

  return sections;
}
