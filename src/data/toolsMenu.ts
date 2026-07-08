export type ToolIcon =
  | "compress"
  | "convert"
  | "merge"
  | "split"
  | "rotate"
  | "delete"
  | "edit"
  | "reader"
  | "number"
  | "crop"
  | "watermark"
  | "pdf-word"
  | "pdf-excel"
  | "pdf-ppt"
  | "pdf-jpg"
  | "word-pdf"
  | "excel-pdf"
  | "ppt-pdf"
  | "jpg-pdf"
  | "sign"
  | "unlock"
  | "protect"
  | "redact";

export type ToolItem = {
  label: string;
  labelKey: string;
  href: string;
  icon: ToolIcon;
};

export type ToolColumn = {
  title: string;
  titleKey: string;
  items: ToolItem[];
};

export const toolIconPaths: Record<ToolIcon, string> = {
  compress: '<path d="M4 14h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM4 4h6v6H4z"/>',
  convert: '<path d="M7 7h10v10H7z"/><path d="M17 3v4M17 3h-4M7 21v-4M7 21h4"/>',
  merge: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  split: '<path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M12 8v8M8 12h8"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  delete: '<path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  reader: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  number: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  watermark: '<path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  "pdf-word": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  "pdf-excel": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13l3 4 3-4"/>',
  "pdf-ppt": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6"/>',
  "pdf-jpg": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  "word-pdf": '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  "excel-pdf": '<path d="M3 3h18v18H3zM8 8l4 4-4 4M12 12h5"/>',
  "ppt-pdf": '<path d="M4 4h16v16H4zM8 8h8v8H8z"/>',
  "jpg-pdf": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8"/>',
  sign: '<path d="M12 3 4 7v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V7l-8-4z"/><path d="m9 12 2 2 4-4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  protect: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  redact:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 21l7-7M14 6l4 4"/><path d="M12 20h9"/>',
};

import {
  menuColumnOrder,
  toolsRegistry,
  type MenuColumnId,
} from "@/data/toolsRegistry";
import { getColumnTitle, getMenuLabel } from "@/i18n/server";

export const toolsMenuColumns: ToolColumn[] = menuColumnOrder.map(
  (columnId: MenuColumnId) => ({
    title: getColumnTitle(columnId),
    titleKey: `menu.columns.${columnId}`,
    items: toolsRegistry
      .filter(t => t.column === columnId)
      .map(
        (t): ToolItem => ({
          label: getMenuLabel(t.i18nKey),
          labelKey: `menu.tools.${t.i18nKey}`,
          href: `/tools/${t.slug}`,
          icon: t.icon,
        })
      ),
  })
);
