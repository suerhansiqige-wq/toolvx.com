declare module "ofd.js" {
  export function parseOfdDocument(options: {
    ofd: File | Blob | ArrayBuffer;
    success?: (res?: unknown) => void;
    fail?: (error: unknown) => void;
  }): void;

  export function renderOfd(
    documentIndex?: number,
    width?: number
  ): Promise<HTMLElement[] | HTMLElement>;

  export function renderOfdByIndex(
    documentIndex: number,
    pageIndex: number,
    width?: number
  ): Promise<HTMLElement>;
}
