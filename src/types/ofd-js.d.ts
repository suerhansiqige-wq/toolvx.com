declare module "ofd.js" {
  export type OfdParsedDocument = {
    pages: unknown[];
    document?: unknown;
    tpls?: unknown;
    fontResObj?: unknown;
    drawParamResObj?: unknown;
    multiMediaResObj?: unknown;
  };

  export function parseOfdDocument(options: {
    ofd: File | Blob | ArrayBuffer;
    success?: (res: OfdParsedDocument[] | OfdParsedDocument) => void;
    fail?: (error: unknown) => void;
  }): void;

  export function renderOfd(
    width: number,
    ofd: OfdParsedDocument
  ): HTMLElement[] | HTMLElement;
}

export {};
