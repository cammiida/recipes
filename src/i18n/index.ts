import nb from './nb.json';
import en from './en.json';

export const locales = ['nb', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'nb';

const dictionaries: Record<Locale, Record<string, string>> = { nb, en };

/** Translate a UI key for the given locale, falling back to the default locale. */
export function t(locale: Locale, key: keyof typeof nb): string {
  return dictionaries[locale]?.[key] ?? dictionaries[defaultLocale][key] ?? String(key);
}
