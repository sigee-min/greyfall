export function baseStatFor(kind) {
    switch (kind) {
        case 'evade': return 'Agility';
        case 'triage': return 'Medicine';
        case 'precision': return 'Dexterity';
        case 'engineering': return 'Engineering';
        case 'medicine': return 'Medicine';
    }
}
export function computeModifiers(params) {
    const { stats, passives, kind } = params;
    let mod = stats[baseStatFor(kind)] ?? 0;
    const labels = [baseStatFor(kind)];
    const has = (id) => passives.some((p) => p.id === id);
    if (kind === 'evade') {
        if (has('evade+')) {
            mod += 1;
            labels.push('evade+');
        }
    }
    if (kind === 'triage' || kind === 'medicine') {
        if (has('triage+')) {
            mod += 1;
            labels.push('triage+');
        }
        if (has('bleed-')) {
            mod += 1;
            labels.push('bleed-');
        }
        if (has('revive+')) {
            mod += 1;
            labels.push('revive+');
        }
    }
    if (kind === 'precision') {
        if (has('stabilize+')) {
            mod += 1;
            labels.push('stabilize+');
        }
        if (has('crit+')) {
            mod += 1;
            labels.push('crit+');
        }
        if (has('fumble+')) {
            mod -= 1;
            labels.push('fumble+');
        }
    }
    if (kind === 'engineering') {
        if (has('blueprint+')) {
            mod += 1;
            labels.push('blueprint+');
        }
        if (has('overclock+')) {
            mod += 1;
            labels.push('overclock+');
        }
        if (has('repair+')) {
            mod += 1;
            labels.push('repair+');
        }
        if (has('jam-')) {
            mod += 1;
            labels.push('jam-');
        }
    }
    // penalties
    if (has('panic+')) {
        mod -= 1;
        labels.push('panic+');
    }
    return { mod, labels };
}
