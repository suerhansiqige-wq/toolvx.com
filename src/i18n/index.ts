import type { UIStrings } from "./types";
import { defaultLocale } from "./config";

export { tplStr } from "./format";
export { defaultLocale, localeList, locales, type Locale } from "./config";

const modules = import.meta.glob<{ default: UIStrings }>("./lang/*.ts", {
  eager: true,
});

const translations: Record<string, UIStrings> = {};
for (const [path, mod] of Object.entries(modules)) {
  const locale = path.slice("./lang/".length, -".ts".length);
  translations[locale] = mod.default;
}

/** Returns UI strings for English (default and only locale). */
export function useTranslations(locale: string = defaultLocale): UIStrings {
  return translations[locale] ?? translations[defaultLocale];
}
