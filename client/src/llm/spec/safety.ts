// Safety policy scaffolding for lightweight, local checks (non-blocking).

import { SAFETY_REASONS } from './whitelist';

export type Locale = 'ko' | 'en';

// Minimal, non-sensitive placeholders. Real deployments can override/extend at runtime.
export const BANNED_PATTERNS: Record<Locale, readonly string[]> = {
  ko: [
    // Keep generic policy terms; avoid shipping sensitive lexicons in source.
    '개인정보', '신상정보', '주소 공개', '살해 예고'
  ],
  en: [
    'doxxing', 'kill threat', 'home address'
  ]
};

export const SAFETY_REASON_LIST = SAFETY_REASONS;

export function screenText(input: string, locale: Locale = 'ko'): { flag: boolean; reasons: string[] } {
  const patterns = BANNED_PATTERNS[locale] ?? [];
  const hay = input.toLowerCase();
  const reasons: string[] = [];
  for (const p of patterns) {
    if (!p) continue;
    const needle = p.toLowerCase();
    if (hay.includes(needle)) {
      if (!reasons.includes('other')) reasons.push('other');
    }
  }
  return { flag: reasons.length > 0, reasons };
}

