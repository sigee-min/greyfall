export type NarrateValidatorOptions = {
  maxSentences?: number;
  maxChars?: number;
};

const DEFAULTS: Required<NarrateValidatorOptions> = {
  maxSentences: 3,
  maxChars: 280
};

function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // Simple sentence boundary on punctuation.
  const parts = trimmed.split(/(?<=[.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [trimmed];
}

export function validateNarrate(textIn: string, opts?: NarrateValidatorOptions): { ok: boolean; fixed?: string; error?: string } {
  const p = { ...DEFAULTS, ...(opts ?? {}) } as Required<NarrateValidatorOptions>;
  const text = String(textIn ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, error: 'empty' };
  const sentences = splitSentences(text).slice(0, p.maxSentences);
  let out = sentences.join(' ');
  if (out.length > p.maxChars) out = out.slice(0, p.maxChars).trim();
  return { ok: true, fixed: out };
}

