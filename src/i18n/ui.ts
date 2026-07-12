/**
 * Unified UI translation dictionary for site-wide strings.
 *
 * This module provides a lightweight, flat-key translation layer
 * for navigation, footer, buttons, and other shared UI elements.
 * It complements the deeper `src/i18n/messages/` and
 * `src/i18n/tool-ui-dictionary.ts` systems.
 */

export const languages: Record<string, string> = {
  en: "English",
  zh: "简体中文",
  es: "Español",
  ja: "日本語",
  de: "Deutsch",
  fr: "Français",
  ko: "한국어",
  pt: "Português",
};

export const defaultLang = "en";

export type UIKey = keyof typeof ui.en;

/**
 * Flat-key UI dictionary.
 * Each key maps to an object with translations for every supported language.
 */
export const ui = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.posts": "Posts",
    "nav.tags": "Tags",
    "nav.about": "About",
    "nav.archives": "Archives",
    "nav.search": "Search",
    "nav.tools": "Tools",
    "nav.redact": "Redact",
    // Footer
    "footer.copyright": "© {{year}} ToolVX",
    "footer.allRightsReserved": "All rights reserved.",
    // Tool buttons
    "btn.download": "Download",
    "btn.processing": "Processing…",
    "btn.success": "Done!",
    "btn.error": "Error",
    "btn.upload": "Upload File",
    "btn.redactNow": "Redact Now",
    "btn.tryFree": "Try Free",
    // Tool descriptions
    "tool.redact.title": "Image & PDF Redaction Tool",
    "tool.redact.desc": "Blur, mosaic, or blackout sensitive areas in images and PDFs — 100% local in your browser.",
    "tool.redact.cta": "Open Redaction Tool",
    // Language switcher
    "lang.switcher": "Language",
    "lang.en": "English",
    "lang.zh": "简体中文",
    "lang.es": "Español",
    "lang.ja": "日本語",
    "lang.de": "Deutsch",
    "lang.fr": "Français",
    "lang.ko": "한국어",
    "lang.pt": "Português",
  },
  zh: {
    "nav.home": "首页",
    "nav.posts": "文章",
    "nav.tags": "标签",
    "nav.about": "关于",
    "nav.archives": "归档",
    "nav.search": "搜索",
    "nav.tools": "工具",
    "nav.redact": "脱敏",
    "footer.copyright": "© {{year}} ToolVX",
    "footer.allRightsReserved": "保留所有权利。",
    "btn.download": "下载",
    "btn.processing": "处理中…",
    "btn.success": "完成！",
    "btn.error": "错误",
    "btn.upload": "上传文件",
    "btn.redactNow": "立即脱敏",
    "btn.tryFree": "免费试用",
    "tool.redact.title": "图片与 PDF 脱敏工具",
    "tool.redact.desc": "在浏览器中对图片与 PDF 敏感区域进行模糊、马赛克或纯色遮盖——100% 本地处理。",
    "tool.redact.cta": "打开脱敏工具",
    "lang.switcher": "语言",
    "lang.en": "English",
    "lang.zh": "简体中文",
    "lang.es": "Español",
    "lang.ja": "日本語",
    "lang.de": "Deutsch",
    "lang.fr": "Français",
    "lang.ko": "한국어",
    "lang.pt": "Português",
  },
  es: {
    "nav.home": "Inicio",
    "nav.posts": "Artículos",
    "nav.tags": "Etiquetas",
    "nav.about": "Acerca de",
    "nav.archives": "Archivo",
    "nav.search": "Buscar",
    "nav.tools": "Herramientas",
    "nav.redact": "Redactar",
    "footer.copyright": "© {{year}} ToolVX",
    "footer.allRightsReserved": "Todos los derechos reservados.",
    "btn.download": "Descargar",
    "btn.processing": "Procesando…",
    "btn.success": "¡Listo!",
    "btn.error": "Error",
    "btn.upload": "Subir archivo",
    "btn.redactNow": "Redactar ahora",
    "btn.tryFree": "Probar gratis",
    "tool.redact.title": "Herramienta de redacción de imágenes y PDF",
    "tool.redact.desc": "Difumine, pixelice o enmascare áreas sensibles en imágenes y PDF — 100% local en su navegador.",
    "tool.redact.cta": "Abrir herramienta de redacción",
    "lang.switcher": "Idioma",
    "lang.en": "English",
    "lang.zh": "简体中文",
    "lang.es": "Español",
    "lang.ja": "日本語",
    "lang.de": "Deutsch",
    "lang.fr": "Français",
    "lang.ko": "한국어",
    "lang.pt": "Português",
  },
  ja: {
    "nav.home": "ホーム",
    "nav.posts": "記事",
    "nav.tags": "タグ",
    "nav.about": "概要",
    "nav.archives": "アーカイブ",
    "nav.search": "検索",
    "nav.tools": "ツール",
    "nav.redact": "墨消し",
    "footer.copyright": "© {{year}} ToolVX",
    "footer.allRightsReserved": "全著作権所有。",
    "btn.download": "ダウンロード",
    "btn.processing": "処理中…",
    "btn.success": "完了！",
    "btn.error": "エラー",
    "btn.upload": "ファイルをアップロード",
    "btn.redactNow": "今すぐ墨消し",
    "btn.tryFree": "無料で試す",
    "tool.redact.title": "画像・PDF 墨消しツール",
    "tool.redact.desc": "画像や PDF の機密領域をぼかし、モザイク、または塗りつぶし — 100% ブラウザ内で完結。",
    "tool.redact.cta": "墨消しツールを開く",
    "lang.switcher": "言語",
    "lang.en": "English",
    "lang.zh": "简体中文",
    "lang.es": "Español",
    "lang.ja": "日本語",
    "lang.de": "Deutsch",
    "lang.fr": "Français",
    "lang.ko": "한국어",
    "lang.pt": "Português",
  },
  de: {
    "nav.home": "Startseite",
    "nav.posts": "Beiträge",
    "nav.tags": "Tags",
    "nav.about": "Über uns",
    "nav.archives": "Archiv",
    "nav.search": "Suche",
    "nav.tools": "Werkzeuge",
    "nav.redact": "Schwärzen",
    "footer.copyright": "© {{year}} ToolVX",
    "footer.allRightsReserved": "Alle Rechte vorbehalten.",
    "btn.download": "Herunterladen",
    "btn.processing": "Verarbeitung…",
    "btn.success": "Fertig!",
    "btn.error": "Fehler",
    "btn.upload": "Datei hochladen",
    "btn.redactNow": "Jetzt schwärzen",
    "btn.tryFree": "Kostenlos testen",
    "tool.redact.title": "Bild- & PDF-Schwärzungswerkzeug",
    "tool.redact.desc": "Verschwommene, pixelierte oder geschwärzte Bereiche in Bildern und PDFs — 100% lokal im Browser.",
    "tool.redact.cta": "Schwärzungswerkzeug öffnen",
    "lang.switcher": "Sprache",
    "lang.en": "English",
    "lang.zh": "简体中文",
    "lang.es": "Español",
    "lang.ja": "日本語",
    "lang.de": "Deutsch",
    "lang.fr": "Français",
    "lang.ko": "한국어",
    "lang.pt": "Português",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.posts": "Articles",
    "nav.tags": "Tags",
    "nav.about": "À propos",
    "nav.archives": "Archives",
    "nav.search": "Recherche",
    "nav.tools": "Outils",
    "nav.redact": "Caviarder",
    "footer.copyright": "© {{year}} ToolVX",
    "footer.allRightsReserved": "Tous droits réservés.",
    "btn.download": "Télécharger",
    "btn.processing": "Traitement…",
    "btn.success": "Terminé !",
    "btn.error": "Erreur",
    "btn.upload": "Téléverser un fichier",
    "btn.redactNow": "Caviarder maintenant",
    "btn.tryFree": "Essayer gratuitement",
    "tool.redact.title": "Outil de caviardage d'images et PDF",
    "tool.redact.desc": "Floutez, pixellisez ou masquez les zones sensibles dans les images et PDF — 100% local dans votre navigateur.",
    "tool.redact.cta": "Ouvrir l'outil de caviardage",
    "lang.switcher": "Langue",
    "lang.en": "English",
    "lang.zh": "简体中文",
    "lang.es": "Español",
    "lang.ja": "日本語",
    "lang.de": "Deutsch",
    "lang.fr": "Français",
    "lang.ko": "한국어",
    "lang.pt": "Português",
  },
  ko: {
    "nav.home": "홈",
    "nav.posts": "게시물",
    "nav.tags": "태그",
    "nav.about": "소개",
    "nav.archives": "아카이브",
    "nav.search": "검색",
    "nav.tools": "도구",
    "nav.redact": "마스킹",
    "footer.copyright": "© {{year}} ToolVX",
    "footer.allRightsReserved": "모든 권리 보유.",
    "btn.download": "다운로드",
    "btn.processing": "처리 중…",
    "btn.success": "완료!",
    "btn.error": "오류",
    "btn.upload": "파일 업로드",
    "btn.redactNow": "지금 마스킹",
    "btn.tryFree": "무료 체험",
    "tool.redact.title": "이미지 & PDF 마스킹 도구",
    "tool.redact.desc": "이미지와 PDF의 민감한 영역을 흐리게, 모자이크 또는 검게 처리 — 100% 브라우저에서 로컬 처리.",
    "tool.redact.cta": "마스킹 도구 열기",
    "lang.switcher": "언어",
    "lang.en": "English",
    "lang.zh": "简体中文",
    "lang.es": "Español",
    "lang.ja": "日本語",
    "lang.de": "Deutsch",
    "lang.fr": "Français",
    "lang.ko": "한국어",
    "lang.pt": "Português",
  },
  pt: {
    "nav.home": "Início",
    "nav.posts": "Artigos",
    "nav.tags": "Tags",
    "nav.about": "Sobre",
    "nav.archives": "Arquivo",
    "nav.search": "Pesquisar",
    "nav.tools": "Ferramentas",
    "nav.redact": "Redigir",
    "footer.copyright": "© {{year}} ToolVX",
    "footer.allRightsReserved": "Todos os direitos reservados.",
    "btn.download": "Baixar",
    "btn.processing": "Processando…",
    "btn.success": "Pronto!",
    "btn.error": "Erro",
    "btn.upload": "Enviar arquivo",
    "btn.redactNow": "Redigir agora",
    "btn.tryFree": "Testar grátis",
    "tool.redact.title": "Ferramenta de redação de imagens e PDF",
    "tool.redact.desc": "Desfoque, pixelize ou cubra áreas sensíveis em imagens e PDFs — 100% local no seu navegador.",
    "tool.redact.cta": "Abrir ferramenta de redação",
    "lang.switcher": "Idioma",
    "lang.en": "English",
    "lang.zh": "简体中文",
    "lang.es": "Español",
    "lang.ja": "日本語",
    "lang.de": "Deutsch",
    "lang.fr": "Français",
    "lang.ko": "한국어",
    "lang.pt": "Português",
  },
} as const;

/**
 * Extract language code from a URL pathname.
 * e.g. "/zh/about/" → "zh", "/es/posts/" → "es", "/" → "en"
 */
export function getLangFromUrl(url: URL | string): string {
  const pathname = typeof url === "string" ? url : url.pathname;
  const match = pathname.match(/^\/(zh|es|ja|de|fr|ko|pt)(?:\/|$)/);
  return match ? match[1] : defaultLang;
}

/**
 * Get a translation function bound to a specific language.
 * Falls back to English for missing keys.
 */
export function useTranslations(lang: string = defaultLang) {
  return function t(key: UIKey, vars?: Record<string, string | number>): string {
    const dict = (ui as Record<string, Record<string, string>>)[lang] ?? ui.en;
    let value = dict[key] ?? ui.en[key] ?? key;
    if (vars) {
      for (const [name, val] of Object.entries(vars)) {
        value = value.replaceAll(`{{${name}}}`, String(val));
      }
    }
    return value;
  };
}

/**
 * Build a localized URL path.
 * e.g. localizedPath("/about/", "zh") → "/zh/about/"
 * e.g. localizedPath("/about/", "en") → "/about/"
 */
export function localizedUiPath(path: string, lang: string): string {
  // Strip existing language prefix
  let basePath = path.replace(/^\/(zh|es|ja|de|fr|ko|pt)(?=\/|$)/, "");
  if (!basePath.startsWith("/")) basePath = "/" + basePath;
  if (lang === defaultLang) return basePath;
  return `/${lang}${basePath}`;
}
