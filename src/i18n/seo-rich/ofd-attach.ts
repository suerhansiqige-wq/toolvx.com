import { ofdToolsRegistry } from "@/data/ofdToolsRegistry";
import { ofdToolsSeoData } from "@/data/ofdToolsSeo";
import type { SeoFaqMessages } from "@/i18n/types";

export type OfdSeoRichMessages = {
  whatIsHeading: string;
  whatIs: string;
  scenarios: string[];
  steps: string[];
  whyChoose: string;
  whyChoosePoints: string[];
  faqs: SeoFaqMessages[];
};

export const ofdSeoHeadingsEn = {
  howTo: "How to use this tool",
  whyChoose: "Why choose our browser-based OFD tool?",
  faq: "Frequently asked questions",
};

export const ofdSeoHeadingsZh = {
  howTo: "如何使用该工具？",
  whyChoose: "为什么选择我们的纯前端 OFD 工具？",
  faq: "常见问题解答 (FAQ)",
};

export function buildOfdSeoRichFromData(
  headings: "en" | "zh",
  zhOverrides?: Record<string, OfdSeoRichMessages>
): Record<string, OfdSeoRichMessages> {
  const result: Record<string, OfdSeoRichMessages> = {};

  for (const tool of ofdToolsRegistry) {
    const seo = ofdToolsSeoData[tool.slug];
    if (!seo) continue;

    const zh = zhOverrides?.[tool.i18nKey];
    const whatIsHeading =
      headings === "zh"
        ? (zh?.whatIsHeading ?? `什么是 ${seo.h1}？`)
        : `What is ${seo.h1}?`;

    result[tool.i18nKey] = zh ?? {
      whatIsHeading,
      whatIs: seo.whatIs,
      scenarios: [...seo.scenarios],
      steps: [...seo.steps],
      whyChoose: seo.whyChoose,
      whyChoosePoints: [...seo.whyChoosePoints],
      faqs: seo.faqs.map(f => ({ ...f })),
    };
  }

  return result;
}
