import { parseJsonLine, normString } from './json-common';

export function validateBullets(text: string, maxLenPerItem = 48): { ok: boolean; fixed?: string; error?: string } {
  const p = parseJsonLine<{ bullets?: unknown }>(text);
  if (!p.ok || !p.value) return { ok: false, error: p.error };
  const arr = Array.isArray(p.value.bullets) ? p.value.bullets : [];
  const bullets = arr.map((b) => normString(b, maxLenPerItem)).filter((v): v is string => Boolean(v));
  const dedup: string[] = [];
  for (const b of bullets) { if (!dedup.includes(b) && dedup.length < 3) dedup.push(b); }
  if (dedup.length < 1) return { ok: false, error: 'empty_bullets' };
  return { ok: true, fixed: JSON.stringify({ bullets: dedup.slice(0, 3) }) };
}

