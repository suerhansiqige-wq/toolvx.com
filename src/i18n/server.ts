import { en } from "@/i18n/messages/en";
import { zh } from "@/i18n/messages/zh";
import { es } from "@/i18n/messages/es";
import { ja } from "@/i18n/messages/ja";
import type { ToolMessages, Messages } from "@/i18n/types";
import type { Locale } from "@/i18n/config";

/** Per-locale message catalogs (ko/fr/de/pt fall back to en). */
const messageCatalogs: Partial<Record<Locale, Messages>> = {
  en,
  zh,
  es,
  ja,
};

function getCatalog(locale: Locale): Messages {
  return messageCatalogs[locale] ?? en;
}

export function getToolMessages(
  i18nKey: string,
  locale: Locale = "en"
): ToolMessages {
  const catalog = getCatalog(locale);
  return catalog.tools[i18nKey] ?? en.tools.compressPdf;
}

export function getMenuLabel(i18nKey: string, locale: Locale = "en"): string {
  const catalog = getCatalog(locale);
  return catalog.menu.tools[i18nKey] ?? i18nKey;
}

export function getColumnTitle(columnId: string, locale: Locale = "en"): string {
  const catalog = getCatalog(locale);
  return catalog.menu.columns[columnId] ?? columnId;
}
