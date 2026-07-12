/**
 * Runtime locale dictionaries for client-side i18n.
 * English (en.json) is the source of truth; other locales fall back to en for missing keys.
 */
import en from "./en.json";
import zh from "./zh.json";
import ja from "./ja.json";
import es from "./es.json";
import de from "./de.json";
import fr from "./fr.json";
import ko from "./ko.json";
import pt from "./pt.json";
import {
  getNestedMessage,
  resolveLocale,
  type LocaleCode,
} from "@/i18n/messages";

export type LocaleBundle = Partial<typeof en>;

/** Locales with dedicated client-side translation bundles. */
export const localeBundles: Partial<Record<LocaleCode, LocaleBundle>> = {
  en,
  zh,
  ja,
  es,
  de,
  fr,
  ko,
  pt,
};

const bundleLocales = Object.keys(localeBundles) as LocaleCode[];

export function hasLocaleBundle(locale: LocaleCode): boolean {
  return bundleLocales.includes(locale);
}

/** Resolve a dot-notation key against the active locale bundle, then English. */
export function getLocaleBundleMessage(
  locale: LocaleCode,
  key: string
): string | undefined {
  const resolved = resolveLocale(locale);
  const bundle = localeBundles[resolved] ?? localeBundles.en;
  const fromActive = getNestedMessage(bundle, key);
  if (fromActive) return fromActive;
  return getNestedMessage(localeBundles.en, key);
}

export { en, zh, ja, es, de, fr, ko, pt };
