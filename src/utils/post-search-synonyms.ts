import en from "@/locales/en.json";
import zh from "@/locales/zh.json";

type RedactPostKey = keyof typeof zh.posts.redact;

const POST_SEARCH_KEYWORDS =
  "文章 博客 指南 教程 知识库 posts articles guides tutorials blog redaction guides 脱敏指南 隐私教程";

const TAG_SEARCH_ZH: Record<string, string> = {
  "pdf-image-redaction": "PDF图片脱敏",
  "pdf-redaction": "PDF脱敏",
  "pdf-security": "PDF安全",
  privacy: "隐私",
  compliance: "合规",
  gdpr: "GDPR",
  hipaa: "HIPAA",
  tutorial: "教程",
  faq: "常见问题",
  "browser-local": "浏览器本地",
  "browser-security": "浏览器安全",
  "browser-tools": "浏览器工具",
  "data-protection": "数据保护",
  "image-anonymization": "图像匿名化",
  "image-privacy": "图片隐私",
  "invoice-redaction": "发票脱敏",
  "multi-page-pdf": "多页PDF",
  "freelancer-security": "自由职业者安全",
};

type PostSearchInput = {
  title: string;
  description?: string;
  i18nKey?: string;
  tags?: string[];
};

function redactBundleEntry(i18nKey: string | undefined, locale: "zh" | "en") {
  if (!i18nKey) return undefined;
  const bundle = locale === "zh" ? zh : en;
  return bundle.posts.redact[i18nKey as RedactPostKey];
}

/** Static Chinese + English strings embedded for Pagefind indexing. */
export function postSearchSynonyms({
  title,
  description,
  i18nKey,
  tags = [],
}: PostSearchInput): string {
  const parts = [POST_SEARCH_KEYWORDS, title];
  if (description) parts.push(description);

  const zhEntry = redactBundleEntry(i18nKey, "zh");
  const enEntry = redactBundleEntry(i18nKey, "en");
  if (zhEntry?.title) parts.push(zhEntry.title);
  if (zhEntry?.description) parts.push(zhEntry.description);
  if (enEntry?.title) parts.push(enEntry.title);
  if (enEntry?.description) parts.push(enEntry.description);

  for (const tag of tags) {
    parts.push(tag);
    const zhTag = TAG_SEARCH_ZH[tag];
    if (zhTag) parts.push(zhTag);
  }

  return parts.filter(Boolean).join(" · ");
}

export function postsListingSearchSynonyms(
  posts: Array<{ data: PostSearchInput }>
): string {
  const parts = [
    POST_SEARCH_KEYWORDS,
    "全部文章 所有指南 all posts all articles",
  ];

  for (const post of posts) {
    parts.push(postSearchSynonyms(post.data));
  }

  return parts.join(" · ");
}
