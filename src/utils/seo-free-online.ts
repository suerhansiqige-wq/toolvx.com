/**
 * Add 免费在线 / Free Online to SEO strings without duplicating the label
 * or altering the rest of the copy.
 */

export function withFreeOnlineZh(text: string): string {
  const s = text.trim();
  if (!s || s.includes("免费在线")) return s;
  if (s.startsWith("在线")) return `免费在线${s.slice(2)}`;
  if (s.startsWith("免费")) return `免费在线${s.slice(2)}`;
  return `免费在线${s}`;
}

export function withFreeOnlineEn(text: string): string {
  const s = text.trim();
  if (!s || /\bfree online\b/i.test(s)) return s;
  if (/\bfree\b/i.test(s) && /\bonline\b/i.test(s)) return s;
  if (/^online\s/i.test(s)) return `Free Online ${s.slice(7)}`;
  return `Free Online ${s}`;
}
