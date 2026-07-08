import type { Messages } from "@/i18n/types";
import { en } from "./en";
import { zh } from "./zh";
import { es } from "./es";
import { ja } from "./ja";

export type LocaleCode = "en" | "zh" | "es" | "ja" | "ko" | "fr" | "de" | "pt" | "ru";

export const catalogs: Record<LocaleCode, Messages> = {
  en,
  zh,
  es,
  ja,
  ko: en,
  fr: en,
  de: en,
  pt: en,
  ru: en,
};

export const supportedLocales: LocaleCode[] = [
  "en",
  "zh",
  "es",
  "ja",
  "ko",
  "fr",
  "de",
  "pt",
  "ru",
];

const localeAliases: Record<string, LocaleCode> = {
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  zh: "zh",
  "zh-cn": "zh",
  "zh-hans": "zh",
  "zh-sg": "zh",
  "zh-tw": "zh",
  "zh-hk": "zh",
  "zh-hant": "zh",
  ja: "ja",
  "ja-jp": "ja",
  ko: "ko",
  "ko-kr": "ko",
  es: "es",
  "es-es": "es",
  "es-mx": "es",
  fr: "fr",
  "fr-fr": "fr",
  de: "de",
  "de-de": "de",
  pt: "pt",
  "pt-br": "pt",
  "pt-pt": "pt",
  ru: "ru",
  "ru-ru": "ru",
};

export function resolveLocale(input?: string | null): LocaleCode {
  if (!input) return "en";
  const normalized = input.toLowerCase().replace(/_/g, "-");
  if (localeAliases[normalized]) return localeAliases[normalized];
  const base = normalized.split("-")[0];
  if (base && localeAliases[base]) return localeAliases[base];
  return "en";
}

export function getNestedMessage(obj: unknown, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export { en, zh, es, ja };
