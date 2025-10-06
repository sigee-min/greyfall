import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isRtl, normalizeLocale, type LocaleKey } from './config';
import { loadMessages, type Messages } from './loader';
import { selectLocale, usePreferencesStore } from '../store/preferences';

type I18nContextValue = {
  locale: LocaleKey;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: LocaleKey) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const prefLocale = usePreferencesStore(selectLocale);
  const setPreference = usePreferencesStore((s) => s.setPreference);
  const [locale, setLocaleState] = useState<LocaleKey>(normalizeLocale(prefLocale));
  const [messages, setMessages] = useState<Messages>({});

  // Keep provider state in sync with preferences
  useEffect(() => {
    const next = normalizeLocale(prefLocale);
    if (next !== locale) setLocaleState(next);
  }, [prefLocale]);

  // Load messages when locale changes
  useEffect(() => {
    let cancelled = false;
    loadMessages(locale).then((m) => {
      if (!cancelled) setMessages(m);
    });

    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
    }

    return () => {
      cancelled = true;
    };
  }, [locale]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const template = messages[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  }, [messages]);

  const setLocale = useCallback((l: LocaleKey) => {
    setPreference('locale', l);
  }, [setPreference]);

  const value = useMemo<I18nContextValue>(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

