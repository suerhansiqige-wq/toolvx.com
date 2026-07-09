export type OfdToolAccent =
  | "sky"
  | "blue"
  | "indigo"
  | "cyan"
  | "teal"
  | "violet"
  | "rose"
  | "amber"
  | "emerald"
  | "slate";

export type OfdToolDefinition = {
  slug: string;
  i18nKey: string;
  accent: OfdToolAccent;
  icon: string;
};

/** SVG path markup (24×24 viewBox) for hub cards. */
export const ofdToolIconPaths: Record<string, string> = {
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  merge:
    '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  svg: '<path d="M4 4h16v16H4z"/><path d="M8 16l4-8 4 8M9.5 13h5"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  compress: '<path d="M4 14h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM4 4h6v6H4z"/>',
  word: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  reader:
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  longImage:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
};

export const ofdToolsRegistry: OfdToolDefinition[] = [
  {
    slug: "ofd-to-pdf",
    i18nKey: "ofdToPdf",
    accent: "sky",
    icon: "pdf",
  },
  {
    slug: "ofd-merge",
    i18nKey: "ofdMerge",
    accent: "blue",
    icon: "merge",
  },
  {
    slug: "ofd-to-image",
    i18nKey: "ofdToImage",
    accent: "indigo",
    icon: "image",
  },
  {
    slug: "ofd-to-svg",
    i18nKey: "ofdToSvg",
    accent: "cyan",
    icon: "svg",
  },
  {
    slug: "ofd-to-web",
    i18nKey: "ofdToWeb",
    accent: "teal",
    icon: "web",
  },
  {
    slug: "ofd-to-text",
    i18nKey: "ofdToText",
    accent: "violet",
    icon: "text",
  },
  {
    slug: "ofd-compress",
    i18nKey: "ofdCompress",
    accent: "rose",
    icon: "compress",
  },
  {
    slug: "ofd-to-word",
    i18nKey: "ofdToWord",
    accent: "amber",
    icon: "word",
  },
  {
    slug: "ofd-reader",
    i18nKey: "ofdReader",
    accent: "emerald",
    icon: "reader",
  },
  {
    slug: "ofd-to-long-image",
    i18nKey: "ofdToLongImage",
    accent: "slate",
    icon: "longImage",
  },
];

export function getOfdToolBySlug(slug: string): OfdToolDefinition | undefined {
  return ofdToolsRegistry.find(tool => tool.slug === slug);
}
