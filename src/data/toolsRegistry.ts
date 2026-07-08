import type { ToolIcon } from "@/data/toolsMenu";

export type MenuColumnId =
  | "compressConvert"
  | "organize"
  | "viewEdit"
  | "convertFromPdf"
  | "convertToPdf"
  | "securitySign";

export type ToolAction =
  | "compress"
  | "merge"
  | "split"
  | "rotate"
  | "delete-pages"
  | "edit-metadata"
  | "reader"
  | "number-pages"
  | "crop"
  | "watermark"
  | "pdf-to-jpg"
  | "jpg-to-pdf"
  | "sign"
  | "unlock"
  | "protect";

export type ToolDefinition = {
  slug: string;
  icon: ToolIcon;
  column: MenuColumnId;
  action: ToolAction;
  accept: string;
  multiple?: boolean;
  /** Key under messages.tools / menu.tools */
  i18nKey: string;
};

export const menuColumnOrder: MenuColumnId[] = [
  "compressConvert",
  "organize",
  "viewEdit",
  "convertFromPdf",
  "convertToPdf",
  "securitySign",
];

export const toolsRegistry: ToolDefinition[] = [
  {
    slug: "compress-pdf",
    icon: "compress",
    column: "compressConvert",
    action: "compress",
    accept: ".pdf,application/pdf",
    multiple: true,
    i18nKey: "compressPdf",
  },
  {
    slug: "merge-pdf",
    icon: "merge",
    column: "organize",
    action: "merge",
    accept: ".pdf,application/pdf",
    multiple: true,
    i18nKey: "mergePdf",
  },
  {
    slug: "split-pdf",
    icon: "split",
    column: "organize",
    action: "split",
    accept: ".pdf,application/pdf",
    i18nKey: "splitPdf",
  },
  {
    slug: "rotate-pdf",
    icon: "rotate",
    column: "organize",
    action: "rotate",
    accept: ".pdf,application/pdf",
    i18nKey: "rotatePdf",
  },
  {
    slug: "delete-pdf-pages",
    icon: "delete",
    column: "organize",
    action: "delete-pages",
    accept: ".pdf,application/pdf",
    i18nKey: "deletePdfPages",
  },
  {
    slug: "edit-pdf",
    icon: "edit",
    column: "viewEdit",
    action: "edit-metadata",
    accept: ".pdf,application/pdf",
    i18nKey: "editPdf",
  },
  {
    slug: "pdf-reader",
    icon: "reader",
    column: "viewEdit",
    action: "reader",
    accept: ".pdf,application/pdf",
    i18nKey: "pdfReader",
  },
  {
    slug: "number-pages",
    icon: "number",
    column: "viewEdit",
    action: "number-pages",
    accept: ".pdf,application/pdf",
    i18nKey: "numberPages",
  },
  {
    slug: "crop-pdf",
    icon: "crop",
    column: "viewEdit",
    action: "crop",
    accept: ".pdf,application/pdf",
    i18nKey: "cropPdf",
  },
  {
    slug: "watermark-pdf",
    icon: "watermark",
    column: "viewEdit",
    action: "watermark",
    accept: ".pdf,application/pdf",
    i18nKey: "watermarkPdf",
  },
  {
    slug: "pdf-to-jpg",
    icon: "pdf-jpg",
    column: "convertFromPdf",
    action: "pdf-to-jpg",
    accept: ".pdf,application/pdf",
    i18nKey: "pdfToJpg",
  },
  {
    slug: "jpg-to-pdf",
    icon: "jpg-pdf",
    column: "convertToPdf",
    action: "jpg-to-pdf",
    accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
    multiple: true,
    i18nKey: "jpgToPdf",
  },
  {
    slug: "sign-pdf",
    icon: "sign",
    column: "securitySign",
    action: "sign",
    accept: ".pdf,application/pdf",
    i18nKey: "signPdf",
  },
  {
    slug: "unlock-pdf",
    icon: "unlock",
    column: "securitySign",
    action: "unlock",
    accept: ".pdf,application/pdf",
    i18nKey: "unlockPdf",
  },
  {
    slug: "protect-pdf",
    icon: "protect",
    column: "securitySign",
    action: "protect",
    accept: ".pdf,application/pdf",
    i18nKey: "protectPdf",
  },
];

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return toolsRegistry.find(t => t.slug === slug);
}
