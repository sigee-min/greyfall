import { parseJsonLine, normString } from './json-common';

export function validateRulesExtract(text: string): { ok: boolean; fixed?: string; error?: string } {
  const p = parseJsonLine<{ keys?: unknown }>(text);
  if (!p.ok || !p.value) return { ok: false, error: p.error };
  const arr = Array.isArray(p.value.keys) ? p.value.keys : [];
  const keys = arr.map((k) => normString(k, 48)).filter((v): v is string => Boolean(v));
  const dedup: string[] = [];
  for (const k of keys) { if (!dedup.includes(k) && dedup.length < 3) dedup.push(k); }
  if (dedup.length === 0) return { ok: false, error: 'empty_keys' };
  return { ok: true, fixed: JSON.stringify({ keys: dedup }) };
}

