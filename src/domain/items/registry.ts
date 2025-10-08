import { normalizeQuery, tokens } from './normalize';
import type { ItemDef, ItemId } from './types';

const byId = new Map<ItemId, ItemDef>();
// Global index: token -> set of item ids
const index = new Map<string, Set<ItemId>>();
// Locale-scoped index: locale -> (token -> set of item ids)
const indexByLocale = new Map<string, Map<string, Set<ItemId>>>();

function addToIndex(token: string, id: ItemId) {
  const key = normalizeQuery(token);
  if (!key) return;
  if (!index.has(key)) index.set(key, new Set());
  index.get(key)!.add(id);
}

function addToLocaleIndex(locale: string, token: string, id: ItemId) {
  const loc = String(locale || '').toLowerCase();
  if (!loc) return addToIndex(token, id);
  const key = normalizeQuery(token);
  if (!key) return;
  if (!indexByLocale.has(loc)) indexByLocale.set(loc, new Map());
  const map = indexByLocale.get(loc)!;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(id);
}

export function registerMany(items: ItemDef[]): void {
  for (const it of items) {
    byId.set(it.id, it);
    for (const name of it.names) {
      for (const tk of tokens(name.text)) { addToIndex(tk, it.id); addToLocaleIndex(name.locale, tk, it.id); }
      addToIndex(name.text, it.id); addToLocaleIndex(name.locale, name.text, it.id);
    }
    for (const syn of it.synonyms ?? []) addToIndex(syn, it.id);
  }
}

export function getItem(id: ItemId): ItemDef | null {
  return byId.get(id) ?? null;
}

export function listItems(): ItemDef[] {
  return [...byId.values()];
}

export function candidatesForToken(q: string): ItemId[] {
  const key = normalizeQuery(q);
  const set = index.get(key);
  return set ? [...set] : [];
}

export function candidatesForTokenLocale(q: string, locale: string): ItemId[] {
  const key = normalizeQuery(q);
  const loc = String(locale || '').toLowerCase();
  const map = indexByLocale.get(loc);
  const set = map?.get(key);
  return set ? [...set] : [];
}

export type SearchResult = { id: ItemId; score: number; reason: 'exact' | 'synonym' | 'contains' | 'fuzzy' };

export function search(raw: string, opts?: { limit?: number }): SearchResult[] {
  const q = normalizeQuery(raw);
  if (!q) return [];
  const seen = new Set<ItemId>();
  const push = (arr: SearchResult[], id: ItemId, score: number, reason: SearchResult['reason']) => {
    if (seen.has(id)) return; seen.add(id); arr.push({ id, score, reason });
  };
  const out: SearchResult[] = [];
  // exact token hit
  for (const id of candidatesForToken(q)) push(out, id, 1.0, 'exact');
  // contains name
  for (const item of byId.values()) {
    if (item.names.some((n) => normalizeQuery(n.text) === q)) continue;
    if (item.synonyms?.some((s) => normalizeQuery(s) === q)) continue;
    if (item.names.some((n) => normalizeQuery(n.text).includes(q))) push(out, item.id, 0.7, 'contains');
  }
  // TODO: fuzzy later in resolver (needs inventory scope)
  const limit = Math.max(1, Math.min(20, opts?.limit ?? 10));
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function searchByLocale(raw: string, locale: string, opts?: { limit?: number }): SearchResult[] {
  const q = normalizeQuery(raw);
  if (!q) return [];
  const loc = String(locale || '').toLowerCase();
  const seen = new Set<ItemId>();
  const out: SearchResult[] = [];
  const push = (id: ItemId, score: number, reason: SearchResult['reason']) => { if (!seen.has(id)) { seen.add(id); out.push({ id, score, reason }); } };
  for (const id of candidatesForTokenLocale(q, loc)) push(id, 1.0, 'exact');
  // contains in locale-specific names
  for (const item of byId.values()) {
    if (item.names.some((n) => n.locale.toLowerCase() === loc && normalizeQuery(n.text) === q)) continue;
    if (item.synonyms?.some((s) => normalizeQuery(s) === q)) continue;
    if (item.names.some((n) => n.locale.toLowerCase() === loc && normalizeQuery(n.text).includes(q))) push(item.id, 0.7, 'contains');
  }
  const limit = Math.max(1, Math.min(20, opts?.limit ?? 10));
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
