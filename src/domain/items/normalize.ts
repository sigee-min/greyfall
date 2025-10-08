export function normalizeQuery(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s\t\n\r]+/g, ' ')
    .replace(/["'`]/g, '')
    .trim();
}

export function tokens(text: string): string[] {
  const t = normalizeQuery(text);
  // Split on non-word boundaries while keeping CJK contiguous segments
  return t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

