import { parseJsonLine, normString } from './json-common';

export function validateDisambiguate(text: string): { ok: boolean; fixed?: string; error?: string } {
  const p = parseJsonLine<{ question?: unknown; options?: unknown }>(text);
  if (!p.ok || !p.value) return { ok: false, error: p.error };
  const q = normString(p.value.question, 60) ?? '선택지를 골라주세요';
  const arr = Array.isArray(p.value.options) ? p.value.options : [];
  const options: string[] = [];
  for (const o of arr) {
    const s = normString(o, 30);
    if (s && !options.includes(s)) options.push(s);
    if (options.length >= 4) break;
  }
  if (options.length < 2) options.push('넘어간다', '멈춘다');
  return { ok: true, fixed: JSON.stringify({ question: q, options: options.slice(0, 4) }) };
}

