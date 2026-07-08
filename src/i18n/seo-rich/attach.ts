import { toolsRegistry } from "@/data/toolsRegistry";
import { toolsSeoData } from "@/data/toolsSeo";
import type { SeoRichMessages, ToolMessages } from "@/i18n/types";
import { withFreeOnlineEn, withFreeOnlineZh } from "@/utils/seo-free-online";

export function seoRichFromSlug(slug: string): SeoRichMessages {
  const seo = toolsSeoData[slug];
  return {
    h1: withFreeOnlineEn(seo.h1),
    introduction: seo.introduction,
    steps: [...seo.steps],
    faqs: seo.faqs.map(faq => ({ ...faq })),
  };
}

type AttachSeoRichOptions = {
  locale?: "en" | "zh";
};

/** Merge per-locale seoRich blocks into each tool entry (keyed by i18nKey). */
export function attachSeoRich<T extends Record<string, ToolMessages>>(
  tools: T,
  overrides?: Partial<Record<keyof T & string, SeoRichMessages>>,
  options?: AttachSeoRichOptions
): T {
  const result = { ...tools } as T;
  const label =
    options?.locale === "zh" ? withFreeOnlineZh : withFreeOnlineEn;

  for (const def of toolsRegistry) {
    const key = def.i18nKey as keyof T & string;
    const entry = result[key];
    if (!entry) continue;

    const seoRich = overrides?.[key] ?? seoRichFromSlug(def.slug);

    result[key] = {
      ...entry,
      seoTitle: label(entry.seoTitle),
      seoRich: {
        ...seoRich,
        h1: label(seoRich.h1),
      },
    };
  }

  return result;
}
