import {
  catalogs,
  getNestedMessage,
  resolveLocale,
  type LocaleCode,
} from "@/i18n/messages";
import { getLocaleBundleMessage } from "@/locales";
import {
  getToolUiMessage,
  isFlatUiKey,
  type ToolUiLocale,
} from "@/i18n/tool-ui-dictionary";
import { syncToolSidebarWidth } from "@/scripts/tool-sidebar-width";

declare global {
  interface Window {
    __siteT?: (key: string, vars?: Record<string, string | number>) => string;
    __closeLightbox?: () => void;
    __lightboxSwapBound?: boolean;
    __postScriptsInit?: boolean;
  }
}

const STORAGE_KEY = "site-locale";

export const LOCALE_CHANGE_EVENT = "site:localechange";

const HTML_LANG: Record<LocaleCode, string> = {
  en: "en",
  zh: "zh-CN",
  es: "es",
  ja: "ja",
  ko: "ko",
  fr: "fr",
  de: "de",
  pt: "pt",
  ru: "ru",
};

/** Map nested data-i18n keys → flat dictionary keys. */
const FLAT_ALIASES: Record<string, string> = {
  "blog.ads.placeholder": "ad_text",
  "blog.ads.ariaLabel": "ad_aria",
  "common.clickToReplace": "click_to_replace",
  "common.clickToReplaceMultiple": "click_to_replace_multi",
  "common.processing": "processing",
  "common.success": "success",
  "common.error": "error_generic",
  "common.compressionLegend": "compression_legend",
  "common.compressionBalanced": "compression_balanced",
  "common.compressionStrong": "compression_strong",
  "common.compressionMaximum": "compression_maximum",
  "common.compressionBalancedHint": "compression_balanced_hint",
  "common.compressionStrongHint": "compression_strong_hint",
  "common.compressionMaximumHint": "compression_maximum_hint",
  "common.compressEach": "compress_each",
  "common.compressMerge": "compress_merge",
  "common.compressSizeLimit": "compress_size_limit",
  "common.compressSizeUnit": "compress_size_unit",
  "common.compressSizeHint": "compress_size_hint",
  "common.compressSizePlaceholder": "compress_size_placeholder",
  "common.compressDefault": "compress_default",
  "common.compressToLimit": "compress_to_limit",
  "common.compressLimitRequired": "compress_limit_required",
  "common.splitMode": "split_mode",
  "common.splitEveryPage": "split_every_page",
  "common.splitAtPageOption": "split_at_page",
  "common.splitPages": "split_pages",
  "common.splitPagesExample": "split_pages_example",
  "reader.fullscreen": "reader_fullscreen",
  "common.pageNumberStartAt": "page_number_start_at",
  "common.pageNumberStartFrom": "page_number_start_from",
  "common.watermarkMode": "watermark_mode",
  "common.watermarkOperation": "watermark_operation",
  "common.watermarkAdd": "watermark_add",
  "common.watermarkRemove": "watermark_remove",
  "common.watermarkRemoveHint": "watermark_remove_hint",
  "common.watermarkTypeText": "watermark_type_text",
  "common.watermarkTypeImage": "watermark_type_image",
  "common.watermarkImage": "watermark_image",
  "common.prevPage": "prev_page",
  "common.nextPage": "next_page",
  "common.password": "password",
  "common.confirmPassword": "confirm_password",
  "common.pageNumbers": "page_numbers_label",
  "common.pageNumbersExample": "page_numbers_example",
  "common.watermarkText": "watermark_text_label",
  "common.rotation": "rotation_label",
  "common.cropMargin": "crop_margin_label",
  "common.metadataTitle": "metadata_title",
  "common.metadataAuthor": "metadata_author",
  "common.metadataSubject": "metadata_subject",
  "common.pageOf": "page_of",
  "common.compressStats": "compress_stats",
  "common.watermarkDefault": "watermark_default",
  "common.signatureDefault": "signature_default",
  "common.signatureText": "signature_text_label",
  "common.signaturePlaceholder": "signature_placeholder",
  "common.passwordMismatch": "password_mismatch",
  "common.seoHowToHeading": "seo_how_to_heading",
  "common.seoFaqHeading": "seo_faq_heading",
  "close_preview": "close_preview",
  "common.dialogOk": "dialog_ok",
};

let currentLocale: LocaleCode = "en";
let messages = catalogs.en;

export function getLocale(): LocaleCode {
  return currentLocale;
}

function flatLocale(): ToolUiLocale {
  if (
    currentLocale === "zh" ||
    currentLocale === "es" ||
    currentLocale === "ja" ||
    currentLocale === "de" ||
    currentLocale === "fr" ||
    currentLocale === "ko" ||
    currentLocale === "pt"
  ) {
    return currentLocale;
  }
  return "en";
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let value: string | undefined;

  if (isFlatUiKey(key)) {
    value = getToolUiMessage(flatLocale(), key);
  } else if (FLAT_ALIASES[key]) {
    value = getToolUiMessage(flatLocale(), FLAT_ALIASES[key]);
  }

  // Runtime locale bundle (src/locales/*.json) — reactive to currentLocale
  if (!value) {
    value = getLocaleBundleMessage(currentLocale, key);
  }

  // Site-wide Astro catalogs
  if (!value) {
    value = getNestedMessage(messages, key) ?? getNestedMessage(catalogs.en, key);
  }

  // Flat UI + English fallbacks
  if (!value && FLAT_ALIASES[key]) {
    value = getToolUiMessage("en", FLAT_ALIASES[key]);
  }
  if (!value && isFlatUiKey(key)) {
    value = getToolUiMessage("en", key);
  }

  // Locale bundle English fallback for any remaining missing keys
  if (!value) {
    value = getLocaleBundleMessage("en", key);
  }

  value = value ?? key;

  if (vars) {
    for (const [name, val] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(val));
    }
  }
  return value;
}

export function setLocale(locale: LocaleCode, persist = true): void {
  currentLocale = resolveLocale(locale);
  messages = catalogs[currentLocale] ?? catalogs.en;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, currentLocale);
    } catch {
      /* ignore */
    }
  }
  document.documentElement.lang = HTML_LANG[currentLocale] ?? "en";
  document.documentElement.setAttribute("data-locale", currentLocale);
  if (typeof window !== "undefined") {
    window.__siteT = t;
  }
  applyI18n();
  document.dispatchEvent(
    new CustomEvent(LOCALE_CHANGE_EVENT, { detail: { locale: currentLocale } })
  );
}

/**
 * Detect the user's preferred locale from localStorage or browser languages.
 * Falls back to English when the language is not in our dictionary.
 */
export function detectBrowserLocale(): LocaleCode {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (stored) return resolveLocale(stored);

  if (typeof navigator === "undefined") return "en";

  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
    (navigator as Navigator & { userLanguage?: string }).userLanguage,
  ].filter((v): v is string => Boolean(v));

  for (const lang of candidates) {
    const code = resolveLocale(lang);
    if (catalogs[code] && code !== "en") return code;
  }

  for (const lang of candidates) {
    const normalized = lang.toLowerCase().replace(/_/g, "-");
    const code = resolveLocale(lang);
    if (code !== "en" || normalized.startsWith("en")) return code;
  }

  return "en";
}

export function onLocaleChange(listener: () => void): () => void {
  document.addEventListener(LOCALE_CHANGE_EVENT, listener);
  return () => document.removeEventListener(LOCALE_CHANGE_EVENT, listener);
}

export function showAppAlert(message: string): void {
  document.getElementById("app-alert-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "app-alert-overlay";
  overlay.className = "app-alert-overlay";
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "app-alert-message");

  const dialog = document.createElement("div");
  dialog.className = "app-alert-dialog";

  const msg = document.createElement("p");
  msg.id = "app-alert-message";
  msg.className = "app-alert-dialog__message";
  msg.textContent = message;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "app-alert-dialog__btn interactive";
  btn.textContent = t("dialog_ok");
  const close = () => overlay.remove();
  btn.addEventListener("click", close);
  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });
  document.addEventListener(
    "keydown",
    function onKey(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    },
    { once: true }
  );

  dialog.append(msg, btn);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  btn.focus();
}

/** Modal prompt with a single-line input (e.g. PDF password). Returns null when cancelled. */
export function showAppPrompt(
  message: string,
  options?: { inputType?: string; placeholder?: string }
): Promise<string | null> {
  document.getElementById("app-alert-overlay")?.remove();

  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.id = "app-alert-overlay";
    overlay.className = "app-alert-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "app-prompt-message");

    const dialog = document.createElement("div");
    dialog.className = "app-alert-dialog";

    const msg = document.createElement("p");
    msg.id = "app-prompt-message";
    msg.className = "app-alert-dialog__message";
    msg.textContent = message;

    const input = document.createElement("input");
    input.type = options?.inputType ?? "text";
    input.className = "app-alert-dialog__input";
    input.placeholder = options?.placeholder ?? "";
    input.autocomplete = "off";

    const actions = document.createElement("div");
    actions.className = "app-alert-dialog__actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "app-alert-dialog__btn app-alert-dialog__btn--secondary interactive";
    cancelBtn.textContent = t("dialog_cancel");

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "app-alert-dialog__btn interactive";
    okBtn.textContent = t("dialog_ok");

    const finish = (value: string | null) => {
      overlay.remove();
      resolve(value);
    };

    cancelBtn.addEventListener("click", () => finish(null));
    okBtn.addEventListener("click", () => finish(input.value));
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(input.value);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
    });
    overlay.addEventListener("click", e => {
      if (e.target === overlay) finish(null);
    });

    actions.append(cancelBtn, okBtn);
    dialog.append(msg, input, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
  });
}

const REDACT_BODY_KEY_RE = /^posts\.redact\.([a-zA-Z]+)\.(b\d+)$/;

const redactPostBlockCache = new Map<string, Record<string, string>>();

async function loadRedactPostBlocks(i18nKey: string, locale: string): Promise<Record<string, string>> {
  const cacheKey = `${locale}:${i18nKey}`;
  const cached = redactPostBlockCache.get(cacheKey);
  if (cached) return cached;

  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  try {
    const res = await fetch(`${base}locales/${locale}-posts/${i18nKey}.json`);
    if (!res.ok) {
      redactPostBlockCache.set(cacheKey, {});
      return {};
    }
    const data = (await res.json()) as Record<string, string>;
    redactPostBlockCache.set(cacheKey, data);
    return data;
  } catch {
    redactPostBlockCache.set(cacheKey, {});
    return {};
  }
}

/** Minimal inline markdown → HTML for redact post body blocks. */
function redactBlockToHtml(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return html;
}

function applyRedactBlockText(el: HTMLElement, zh: string): void {
  const needsHtml =
    /\[.+\]\(.+\)|\*\*.+\*\*|`.+`/.test(zh) ||
    Boolean(el.querySelector("a, strong, em, code"));
  if (needsHtml) {
    el.innerHTML = redactBlockToHtml(zh);
  } else {
    el.textContent = zh;
  }
}

async function applyRedactPostBodyI18n(
  root: ParentNode,
  locale: LocaleCode
): Promise<void> {
  // Only apply for non-English locales that have post translations
  if (locale === "en") return;

  const byArticle = new Map<string, { el: HTMLElement; blockKey: string }[]>();
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = el.getAttribute("data-i18n");
    if (!key) continue;
    const match = key.match(REDACT_BODY_KEY_RE);
    if (!match) continue;
    const i18nKey = match[1];
    const blockKey = match[2];
    if (!byArticle.has(i18nKey)) byArticle.set(i18nKey, []);
    byArticle.get(i18nKey)!.push({ el, blockKey });
  }

  await Promise.all(
    [...byArticle.entries()].map(async ([i18nKey, items]) => {
      const blocks = await loadRedactPostBlocks(i18nKey, locale);
      for (const { el, blockKey } of items) {
        const text = blocks[blockKey];
        if (text) applyRedactBlockText(el, text);
      }
    })
  );
}

export function applyI18n(root: ParentNode = document): void {
  const locale = flatLocale();

  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const varsRaw = el.getAttribute("data-i18n-vars");
    let vars: Record<string, string | number> | undefined;
    if (varsRaw) {
      try {
        vars = JSON.parse(varsRaw) as Record<string, string | number>;
      } catch {
        /* ignore */
      }
    }

    const fromBundle = getLocaleBundleMessage(locale, key);
    if (fromBundle) {
      let value = fromBundle;
      if (vars) {
        for (const [name, val] of Object.entries(vars)) {
          value = value.replaceAll(`{${name}}`, String(val));
        }
      }
      el.textContent = value;
      return;
    }

    if (!key.startsWith("posts.redact.") && !key.startsWith("pages.")) {
      el.textContent = t(key, vars);
    }
  });

  root.querySelectorAll<HTMLOptionElement>("option[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (!key) return;
    const varsRaw = el.getAttribute("data-i18n-vars");
    let vars: Record<string, string | number> | undefined;
    if (varsRaw) {
      try {
        vars = JSON.parse(varsRaw) as Record<string, string | number>;
      } catch {
        /* ignore */
      }
    }
    el.innerHTML = t(key, vars);
  });

  root.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) el.placeholder = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    if (!key) return;
    const varsRaw = el.getAttribute("data-i18n-vars");
    let vars: Record<string, string | number> | undefined;
    if (varsRaw) {
      try {
        vars = JSON.parse(varsRaw) as Record<string, string | number>;
      } catch {
        /* ignore */
      }
    }
    el.setAttribute("title", t(key, vars));
  });

  root.querySelectorAll<HTMLInputElement>("[data-i18n-value]").forEach(el => {
    const key = el.getAttribute("data-i18n-value");
    if (key) el.value = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach(el => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (!key) return;
    const varsRaw = el.getAttribute("data-i18n-vars");
    let vars: Record<string, string | number> | undefined;
    if (varsRaw) {
      try {
        vars = JSON.parse(varsRaw) as Record<string, string | number>;
      } catch {
        /* ignore */
      }
    }
    el.setAttribute("aria-label", t(key, vars));
  });

  root.querySelectorAll<HTMLMetaElement>("[data-i18n-content]").forEach(el => {
    const key = el.getAttribute("data-i18n-content");
    if (!key) return;
    const value = t(key);
    el.setAttribute("content", value);
  });

  root.querySelectorAll<HTMLImageElement>("[data-i18n-alt]").forEach(el => {
    const key = el.getAttribute("data-i18n-alt");
    if (key) el.alt = t(key);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-label-open-key]").forEach(btn => {
    const openKey = btn.getAttribute("data-label-open-key");
    const closeKey = btn.getAttribute("data-label-close-key");
    if (openKey) btn.dataset.labelOpen = t(openKey);
    if (closeKey) btn.dataset.labelClose = t(closeKey);

    const expanded = btn.getAttribute("aria-expanded") === "true";
    const label = expanded ? btn.dataset.labelClose : btn.dataset.labelOpen;
    if (label) btn.setAttribute("aria-label", label);
  });

  syncToolSidebarWidth(root);
  void applyRedactPostBodyI18n(root, currentLocale);
}

export function initI18n(): void {
  // 1. Detect locale from URL path (highest priority)
  const pathLocale = detectLocaleFromPath();
  if (pathLocale) {
    setLocale(pathLocale, true);
    return;
  }

  // 2. Fall back to stored preference or browser detection
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }

  const detected = stored ? resolveLocale(stored) : detectBrowserLocale();
  setLocale(detected, Boolean(stored));
}

/** Extract locale code from URL pathname, e.g. "/zh/about/" → "zh". */
function detectLocaleFromPath(): LocaleCode | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  const match = path.match(/^\/(zh|es|ja|de|fr|ko|pt)(?:\/|$)/);
  return match ? (match[1] as LocaleCode) : null;
}

export function onI18nReady(init: () => void): void {
  initI18n();
  init();
  const rerun = () => {
    initI18n();
    init();
  };
  document.addEventListener("astro:page-load", rerun);
  document.addEventListener("astro:after-swap", rerun);
}
