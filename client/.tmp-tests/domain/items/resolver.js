import { normalizeQuery } from './normalize';
import { similarity } from './fuzzy';
import { getItem, listItems, search, searchByLocale } from './registry';
export function resolveItem(raw, opts) {
    const q = normalizeQuery(raw);
    const inventory = (opts?.inventory ?? []).slice();
    const slotHint = opts?.slotHint ?? 'any';
    const threshold = typeof opts?.threshold === 'number' ? opts.threshold : 0.66;
    const locale = opts?.localeHint;
    if (!q)
        return { id: null, score: 0, reason: 'none', candidates: [] };
    const applySlotFilter = (ids) => {
        if (!ids.length)
            return ids;
        if (slotHint === 'any')
            return ids;
        return ids.filter((id) => {
            const it = getItem(id);
            return it?.slot ? it.slot === slotHint : false;
        });
    };
    // 1) Inventory exact
    const invExact = inventory.find((id) => normalizeQuery(id) === q);
    if (invExact && applySlotFilter([invExact]).length) {
        return { id: invExact, score: 1.0, reason: 'inventory-exact', candidates: [{ id: invExact, score: 1, reason: 'exact' }] };
    }
    // 2) Inventory contains (id contains token)
    const invContains = inventory.find((id) => normalizeQuery(id).includes(q));
    if (invContains && applySlotFilter([invContains]).length) {
        return { id: invContains, score: 0.8, reason: 'inventory-contains', candidates: [{ id: invContains, score: 0.8, reason: 'contains' }] };
    }
    // 3) Registry search (exact/synonym/contains)
    const base = locale ? searchByLocale(q, locale, { limit: opts?.limit ?? 10 }) : search(q, { limit: opts?.limit ?? 10 });
    const filtered = base.filter((c) => applySlotFilter([c.id]).length);
    if (filtered.length) {
        // If an inventory item appears among candidates, boost it
        const boosted = filtered.map((c) => (inventory.includes(c.id) ? { ...c, score: Math.max(c.score, 0.9) } : c));
        boosted.sort((a, b) => b.score - a.score);
        const top = boosted[0];
        return { id: top.id, score: top.score, reason: top.reason, candidates: boosted };
    }
    // 4) Fuzzy (inventory first, then registry)
    const simOf = (id) => similarity(q, normalizeQuery(id));
    const invFuzzy = inventory
        .map((id) => ({ id, score: simOf(id) }))
        .filter((x) => x.score >= threshold && applySlotFilter([x.id]).length)
        .sort((a, b) => b.score - a.score);
    if (invFuzzy.length)
        return { id: invFuzzy[0].id, score: invFuzzy[0].score, reason: 'fuzzy', candidates: invFuzzy.map((x) => ({ id: x.id, score: x.score, reason: 'fuzzy' })) };
    const registryIds = listItems().map((i) => i.id);
    const regFuzzy = registryIds
        .map((id) => ({ id, score: simOf(id) }))
        .filter((x) => x.score >= threshold && applySlotFilter([x.id]).length)
        .sort((a, b) => b.score - a.score)
        .slice(0, opts?.limit ?? 10)
        .map((x) => ({ id: x.id, score: x.score, reason: 'fuzzy' }));
    if (regFuzzy.length)
        return { id: regFuzzy[0].id, score: regFuzzy[0].score, reason: 'fuzzy', candidates: regFuzzy };
    return { id: null, score: 0, reason: 'none', candidates: [] };
}
