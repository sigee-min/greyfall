import { normalizeQuery, tokens } from './normalize';
const byId = new Map();
// Global index: token -> set of item ids
const index = new Map();
// Locale-scoped index: locale -> (token -> set of item ids)
const indexByLocale = new Map();
function addToIndex(token, id) {
    const key = normalizeQuery(token);
    if (!key)
        return;
    if (!index.has(key))
        index.set(key, new Set());
    index.get(key).add(id);
}
function addToLocaleIndex(locale, token, id) {
    const loc = String(locale || '').toLowerCase();
    if (!loc)
        return addToIndex(token, id);
    const key = normalizeQuery(token);
    if (!key)
        return;
    if (!indexByLocale.has(loc))
        indexByLocale.set(loc, new Map());
    const map = indexByLocale.get(loc);
    if (!map.has(key))
        map.set(key, new Set());
    map.get(key).add(id);
}
export function registerMany(items) {
    for (const it of items) {
        byId.set(it.id, it);
        for (const name of it.names) {
            for (const tk of tokens(name.text)) {
                addToIndex(tk, it.id);
                addToLocaleIndex(name.locale, tk, it.id);
            }
            addToIndex(name.text, it.id);
            addToLocaleIndex(name.locale, name.text, it.id);
        }
        for (const syn of it.synonyms ?? [])
            addToIndex(syn, it.id);
    }
}
export function getItem(id) {
    return byId.get(id) ?? null;
}
export function listItems() {
    return [...byId.values()];
}
export function candidatesForToken(q) {
    const key = normalizeQuery(q);
    const set = index.get(key);
    return set ? [...set] : [];
}
export function candidatesForTokenLocale(q, locale) {
    const key = normalizeQuery(q);
    const loc = String(locale || '').toLowerCase();
    const map = indexByLocale.get(loc);
    const set = map?.get(key);
    return set ? [...set] : [];
}
export function search(raw, opts) {
    const q = normalizeQuery(raw);
    if (!q)
        return [];
    const seen = new Set();
    const push = (arr, id, score, reason) => {
        if (seen.has(id))
            return;
        seen.add(id);
        arr.push({ id, score, reason });
    };
    const out = [];
    // exact token hit
    for (const id of candidatesForToken(q))
        push(out, id, 1.0, 'exact');
    // contains name
    for (const item of byId.values()) {
        if (item.names.some((n) => normalizeQuery(n.text) === q))
            continue;
        if (item.synonyms?.some((s) => normalizeQuery(s) === q))
            continue;
        if (item.names.some((n) => normalizeQuery(n.text).includes(q)))
            push(out, item.id, 0.7, 'contains');
    }
    // TODO: fuzzy later in resolver (needs inventory scope)
    const limit = Math.max(1, Math.min(20, opts?.limit ?? 10));
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
export function searchByLocale(raw, locale, opts) {
    const q = normalizeQuery(raw);
    if (!q)
        return [];
    const loc = String(locale || '').toLowerCase();
    const seen = new Set();
    const out = [];
    const push = (id, score, reason) => { if (!seen.has(id)) {
        seen.add(id);
        out.push({ id, score, reason });
    } };
    for (const id of candidatesForTokenLocale(q, loc))
        push(id, 1.0, 'exact');
    // contains in locale-specific names
    for (const item of byId.values()) {
        if (item.names.some((n) => n.locale.toLowerCase() === loc && normalizeQuery(n.text) === q))
            continue;
        if (item.synonyms?.some((s) => normalizeQuery(s) === q))
            continue;
        if (item.names.some((n) => n.locale.toLowerCase() === loc && normalizeQuery(n.text).includes(q)))
            push(item.id, 0.7, 'contains');
    }
    const limit = Math.max(1, Math.min(20, opts?.limit ?? 10));
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
