import { en } from "@/i18n/messages/en";
import type { ToolMessages } from "@/i18n/types";

export function getToolMessages(i18nKey: string): ToolMessages {
  return en.tools[i18nKey] ?? en.tools.compressPdf;
}

export function getMenuLabel(i18nKey: string): string {
  return en.menu.tools[i18nKey] ?? i18nKey;
}

export function getColumnTitle(columnId: string): string {
  return en.menu.columns[columnId] ?? columnId;
}
