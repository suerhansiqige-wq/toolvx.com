/** Minimal pdf.js page/document surface used across tool scripts. */
export type PdfPageProxy = {
  getViewport(params: { scale: number; rotation?: number }): {
    width: number;
    height: number;
  };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas?: HTMLCanvasElement;
    background?: string;
    intent?: string;
    annotationMode?: number;
    disableCreateImageBitmap?: boolean;
    enableWebGL?: boolean;
  }): { promise: Promise<void>; cancel?: () => void };
  getTextContent(): Promise<{
    items: Array<{ str?: string } | Record<string, unknown>>;
  }>;
};

export type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
};

export type PdfJsModule = {
  getDocument(src: Record<string, unknown>): { promise: Promise<PdfDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
};
