export function normalizeQuery(raw: string): string {
  const s = String(raw || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s\t\n\r]+/g, ' ')
    .replace(/["'`]/g, '')
    .trim();
  // Strip diacritics (NFD + remove combining marks)
  try {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    return s;
  }
}

export function tokens(text: string): string[] {
  const t = normalizeQuery(text);
  // Split on non-word boundaries while keeping CJK contiguous segments
  return t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
