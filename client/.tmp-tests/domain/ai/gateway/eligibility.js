function lineActors(a) {
    const hp = a.hp ? ` hp=${a.hp.cur}/${a.hp.max}` : '';
    const role = a.role ? ` role=${a.role}` : '';
    const name = a.name ? ` name=${a.name}` : '';
    const status = a.status && a.status.length ? ` status=[${a.status.join(',')}]` : ' status=[]';
    return `${a.id}${role}${name}${hp}${status}`.trim();
}
function linePosition(a) {
    const map = a.mapId ? ` map=${a.mapId}` : '';
    const field = a.fieldId ? ` field=${a.fieldId}` : '';
    const pos = a.pos ? ` pos=${a.pos.x},${a.pos.y}` : '';
    if (!map && !field && !pos)
        return null;
    return `${a.id}${map}${field}${pos}`.trim();
}
function sameField(a, b) {
    if (!a || !b)
        return false;
    return Boolean(a.mapId &&
        b.mapId &&
        a.fieldId &&
        b.fieldId &&
        a.mapId === b.mapId &&
        a.fieldId === b.fieldId);
}
export function buildEligibilitySections(input) {
    const { requesterActorId, actors, inventory, rules } = input;
    const sections = {};
    // Requester snapshot
    const self = actors.find((x) => x.id === requesterActorId);
    if (self) {
        const hp = self.hp ? ` hp=${self.hp.cur}/${self.hp.max}` : '';
        const role = self.role ? ` role=${self.role}` : '';
        const status = self.status && self.status.length ? ` status=[${self.status.join(',')}]` : ' status=[]';
        sections.requester = `actor=${self.id} (self)${role}${hp}${status}`;
    }
    else {
        sections.requester = `actor=${requesterActorId} (self)`;
    }
    // Actors list
    sections.actors = actors.map(lineActors);
    // Positions
    const posLines = actors.map(linePosition).filter((l) => Boolean(l));
    if (posLines.length)
        sections.positions = posLines;
    // Rules
    const ruleLines = [];
    if (rules?.sameFieldRequiredForHeal)
        ruleLines.push('same_field_required_for_heal=true');
    if (rules?.sameFieldRequiredForGive)
        ruleLines.push('same_field_required_for_give=true');
    if (ruleLines.length)
        sections.rules = ruleLines;
    // Inventory
    if (inventory) {
        const invLines = [];
        for (const [actorId, items] of Object.entries(inventory)) {
            if (!items || items.length === 0)
                continue;
            const body = items.map((it) => `${it.key}(${Math.max(0, Math.floor(it.count || 0))})`).join(', ');
            invLines.push(`${actorId} items=[${body}]`);
        }
        if (invLines.length)
            sections.inventory = invLines;
    }
    // Eligible targets (heal / item.give)
    const healTargets = [];
    const giveTargets = [];
    for (const a of actors) {
        if (a.id === requesterActorId)
            continue;
        if (rules?.sameFieldRequiredForHeal) {
            if (!sameField(self, a))
                continue;
        }
        healTargets.push(a.id);
    }
    for (const a of actors) {
        if (a.id === requesterActorId)
            continue;
        if (rules?.sameFieldRequiredForGive) {
            if (!sameField(self, a))
                continue;
        }
        giveTargets.push(a.id);
    }
    const targetLines = [];
    if (healTargets.length)
        targetLines.push(`heal:[${healTargets.join(',')}]`);
    if (giveTargets.length)
        targetLines.push(`item.give:[${giveTargets.join(',')}]`);
    if (targetLines.length)
        sections.targetsEligible = targetLines;
    return sections;
}
