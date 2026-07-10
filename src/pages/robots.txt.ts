import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL) => `# Allow all search engines
User-agent: *
Allow: /

# Google
User-agent: Googlebot
Allow: /

# AI crawlers — allow indexing (set Disallow to block)
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Bytespider
Allow: /

# Build artifacts — not useful for search
Disallow: /pagefind/
Disallow: /pdfjs/

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("sitemap-index.xml", site);
  return new Response(getRobotsTxt(sitemapURL), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
