/** Eight-locale i18n configuration. */
export const locales = {
  en: { name: "English", dir: "ltr" },
  zh: { name: "简体中文", dir: "ltr" },
  es: { name: "Español", dir: "ltr" },
  ja: { name: "日本語", dir: "ltr" },
  de: { name: "Deutsch", dir: "ltr" },
  fr: { name: "Français", dir: "ltr" },
  ko: { name: "한국어", dir: "ltr" },
  pt: { name: "Português", dir: "ltr" },
} as const;

export type Locale = keyof typeof locales;

export const defaultLocale: Locale = "en";

export const localeList = Object.keys(locales) as Locale[];

export const nonDefaultLocales = localeList.filter(
  l => l !== defaultLocale
) as Locale[];

/** Map of URL path prefixes to locale codes. */
export const localePathMap: Record<string, Locale> = {
  "/": "en",
  "/zh/": "zh",
  "/es/": "es",
  "/ja/": "ja",
  "/de/": "de",
  "/fr/": "fr",
  "/ko/": "ko",
  "/pt/": "pt",
};

/** Extract locale from a URL pathname. Returns defaultLocale for root. */
export function getLocaleFromPath(pathname: string): Locale {
  // Exact match first
  if (pathname in localePathMap) return localePathMap[pathname];
  // Prefix match for nested routes
  for (const [prefix, locale] of Object.entries(localePathMap)) {
    if (prefix !== "/" && pathname.startsWith(prefix)) return locale;
  }
  return defaultLocale;
}

/** Detect browser preferred locale from navigator.language(s). */
export function matchBrowserLocale(
  navigatorLanguages?: readonly string[]
): Locale {
  const candidates: string[] = [];
  if (typeof navigator !== "undefined") {
    if (navigatorLanguages) candidates.push(...navigatorLanguages);
    if (navigator.language) candidates.push(navigator.language);
    const nav = navigator as Navigator & { userLanguage?: string };
    if (nav.userLanguage) candidates.push(nav.userLanguage);
  }

  const supported = new Set(localeList);
  for (const lang of candidates) {
    const code = lang.slice(0, 2).toLowerCase() as Locale;
    if (supported.has(code)) return code;
  }
  return defaultLocale;
}

/** Get the URL prefix for a given locale (e.g. "/zh" for zh, "" for en). */
export function getLocalePrefix(locale: Locale): string {
  if (locale === defaultLocale) return "";
  return `/${locale}`;
}

/** Build a localized URL path. */
export function localizedPath(path: string, locale: Locale): string {
  const prefix = getLocalePrefix(locale);
  // Remove existing locale prefix if present
  let basePath = path;
  for (const loc of nonDefaultLocales) {
    if (basePath.startsWith(`/${loc}/`)) {
      basePath = basePath.slice(`/${loc}`.length);
      break;
    }
  }
  if (basePath === "/") basePath = "";
  return prefix + basePath + (basePath.endsWith("/") ? "" : "/");
}
