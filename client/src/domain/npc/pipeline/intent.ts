export type Intent = 'greet' | 'ask' | 'request' | 'other';

export function classifyIntent(text: string): Intent {
  const t = (text || '').trim().toLowerCase();
  if (!t) return 'other';
  if (/\b(hi|hello|안녕|반가)/.test(t)) return 'greet';
  if (/[?]|\b(why|how|어떻게|왜|무엇)/.test(t)) return 'ask';
  if (/\b(give|help|please|주세요|부탁)/.test(t)) return 'request';
  return 'other';
}

