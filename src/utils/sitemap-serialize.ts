import type { SitemapItem } from "@astrojs/sitemap";
import postDates from "../data/sitemap-post-dates.json";

function pathnameOf(url: string): string {
  return new URL(url).pathname;
}

export function serializeSitemapItem(item: SitemapItem): SitemapItem {
  const path = pathnameOf(item.url);
  const postLastmod = postDates[path as keyof typeof postDates];

  if (path === "/" || path === "") {
    return { ...item, priority: 1 };
  }

  if (
    path.startsWith("/tools/") ||
    path === "/redact-preview/" ||
    path === "/converter/"
  ) {
    return { ...item, priority: 0.9 };
  }

  if (path.startsWith("/posts/") && path !== "/posts/") {
    return {
      ...item,
      priority: 0.8,
      ...(postLastmod ? { lastmod: postLastmod } : {}),
    };
  }

  if (path.startsWith("/tags/") || path === "/search/" || path === "/archives/") {
    return { ...item, priority: 0.4 };
  }

  return item;
}
