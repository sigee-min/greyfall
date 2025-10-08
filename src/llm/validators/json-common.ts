export function parseJsonLine<T = unknown>(text: string): { ok: boolean; value?: T; error?: string } {
  const t = String(text ?? '').trim();
  if (!t) return { ok: false, error: 'empty' };
  try {
    const obj = JSON.parse(t) as T;
    return { ok: true, value: obj };
  } catch (e) {
    return { ok: false, error: 'invalid_json' };
  }
}

export function clamp<T>(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normString(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}

