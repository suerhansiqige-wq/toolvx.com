import { zh } from "@/i18n/messages/zh";
import type { ToolMessages } from "@/i18n/types";

/** Static Chinese strings embedded for Pagefind indexing. */
export function toolSearchSynonyms(i18nKey: string): string {
  const tool = zh.tools[i18nKey as keyof typeof zh.tools] as ToolMessages | undefined;
  if (!tool) return "";
  const parts = [
    tool.title,
    tool.seoTitle,
    tool.tagline,
    tool.seoRich?.h1,
    tool.seoRich?.introduction,
  ];
  return parts.filter(Boolean).join(" · ");
}

export const redactSearchSynonyms =
  "图片打码 在线图片与 PDF 打码 免费在线图片与 PDF 打码工具 PDF打码 图片与 PDF 打码";
