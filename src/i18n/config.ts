/** English-only locale configuration. */
export const locales = {
  en: { name: "English", dir: "ltr" },
} as const;

export type Locale = keyof typeof locales;

export const defaultLocale: Locale = "en";

export const localeList = Object.keys(locales) as Locale[];

export const nonDefaultLocales = [] as const;

export function matchBrowserLocale(): Locale {
  return defaultLocale;
}

export function getLocaleFromPath(): null {
  return null;
}
