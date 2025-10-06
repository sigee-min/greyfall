import type { LocaleKey } from './config';

export type Messages = Record<string, string>;

export async function loadMessages(locale: LocaleKey): Promise<Messages> {
  switch (locale) {
    case 'ko':
      return (await import('./locales/ko.json')).default as Messages;
    case 'en':
    default:
      return (await import('./locales/en.json')).default as Messages;
  }
}

