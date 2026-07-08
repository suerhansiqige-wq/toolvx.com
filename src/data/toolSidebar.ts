import type { ToolIcon } from "@/data/toolsMenu";
import { getMenuLabel } from "@/i18n/server";
import { getToolBySlug } from "@/data/toolsRegistry";

export type SidebarGroupId = "compressConvert" | "organize" | "security";

export type SidebarItem = {
  slug: string;
  href: string;
  label: string;
  i18nKey: string;
  icon: ToolIcon;
};

export type SidebarGroup = {
  id: SidebarGroupId;
  title: string;
  titleKey: string;
  items: SidebarItem[];
};

const sidebarSlugMap: Record<SidebarGroupId, string[]> = {
  compressConvert: [
    "compress-pdf",
    "pdf-to-jpg",
    "jpg-to-pdf",
  ],
  organize: [
    "merge-pdf",
    "split-pdf",
    "rotate-pdf",
    "delete-pdf-pages",
    "edit-pdf",
    "pdf-reader",
    "number-pages",
    "crop-pdf",
    "watermark-pdf",
  ],
  security: ["sign-pdf", "unlock-pdf", "protect-pdf"],
};

const sidebarGroupMeta: {
  id: SidebarGroupId;
  title: string;
  titleKey: string;
}[] = [
  {
    id: "compressConvert",
    title: "COMPRESS & CONVERT",
    titleKey: "site.sidebar.sections.compressConvert",
  },
  {
    id: "organize",
    title: "ORGANIZE",
    titleKey: "site.sidebar.sections.organize",
  },
  {
    id: "security",
    title: "SECURITY",
    titleKey: "site.sidebar.sections.security",
  },
];

export function buildToolSidebarGroups(
  resolveHref: (slug: string) => string
): SidebarGroup[] {
  return sidebarGroupMeta.map(group => ({
    ...group,
    items: sidebarSlugMap[group.id]
      .map(slug => {
        const tool = getToolBySlug(slug);
        if (!tool) return null;
        return {
          slug: tool.slug,
          href: resolveHref(tool.slug),
          label: getMenuLabel(tool.i18nKey),
          i18nKey: tool.i18nKey,
          icon: tool.icon,
        };
      })
      .filter((item): item is SidebarItem => item !== null),
  }));
}

export function isToolPathActive(currentPath: string, href: string): boolean {
  const normalize = (path: string) => {
    const value = path.startsWith("http")
      ? new URL(path).pathname
      : path.split("?")[0] ?? path;
    return value.replace(/\/$/, "") || "/";
  };

  const current = normalize(currentPath);
  const target = normalize(href);

  return current === target || current.endsWith(target);
}
