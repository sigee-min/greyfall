export const SUPPORTED_LOCALES = ['en', 'ko'] as const;
export type LocaleKey = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: LocaleKey = 'en';

export function normalizeLocale(input: string | null | undefined): LocaleKey {
  const v = (input ?? '').toLowerCase();
  if (v.startsWith('ko')) return 'ko';
  return 'en';
}

export function isRtl(_locale: LocaleKey): boolean {
  // No RTL locales yet. Extend when adding ar/he/fa...
  return false;
}

