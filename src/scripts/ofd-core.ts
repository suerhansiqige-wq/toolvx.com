const OFD_ACCEPT = ".ofd,application/ofd,application/octet-stream";
const DEFAULT_RENDER_WIDTH = 794;

export function isOfdFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".ofd") || file.type === "application/ofd";
}

async function loadOfdModule() {
  const mod = await import("ofd.js");
  return mod;
}

export async function parseOfdFile(file: File): Promise<void> {
  const { parseOfdDocument } = await loadOfdModule();
  await new Promise<void>((resolve, reject) => {
    parseOfdDocument({
      ofd: file,
      success() {
        resolve();
      },
      fail(error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    });
  });
}

function normalizePageDivs(result: HTMLElement | HTMLElement[]): HTMLElement[] {
  return Array.isArray(result) ? result : [result];
}

export async function renderOfdPages(width = DEFAULT_RENDER_WIDTH): Promise<HTMLElement[]> {
  const { renderOfd } = await loadOfdModule();
  const result = await renderOfd(0, width);
  return normalizePageDivs(result);
}

export function extractCanvasesFromPages(pages: HTMLElement[]): HTMLCanvasElement[] {
  const canvases: HTMLCanvasElement[] = [];
  for (const page of pages) {
    const canvas = page.querySelector("canvas");
    if (canvas instanceof HTMLCanvasElement) {
      canvases.push(canvas);
    }
  }
  return canvases;
}

export async function loadOfdPreview(
  file: File,
  width = DEFAULT_RENDER_WIDTH
): Promise<{ pages: HTMLElement[]; canvases: HTMLCanvasElement[] }> {
  if (!isOfdFile(file)) {
    throw new Error("invalid-ofd");
  }
  await parseOfdFile(file);
  const pages = await renderOfdPages(width);
  const canvases = extractCanvasesFromPages(pages);
  return { pages, canvases };
}

export async function exportCanvasesToPdf(canvases: HTMLCanvasElement[]): Promise<Blob> {
  if (canvases.length === 0) {
    throw new Error("no-pages");
  }

  const { jsPDF } = await import("jspdf");
  let pdf: InstanceType<typeof jsPDF> | null = null;

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const w = canvas.width;
    const h = canvas.height;

    if (i === 0) {
      pdf = new jsPDF({
        orientation: w >= h ? "landscape" : "portrait",
        unit: "px",
        format: [w, h],
      });
    } else {
      pdf!.addPage([w, h], w >= h ? "landscape" : "portrait");
    }

    pdf!.addImage(imgData, "JPEG", 0, 0, w, h, undefined, "FAST");
  }

  return pdf!.output("blob") as Blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function pdfFilenameFromOfd(sourceName: string): string {
  const base = sourceName.replace(/\.ofd$/i, "") || "document";
  return `${base}.pdf`;
}

export { OFD_ACCEPT, DEFAULT_RENDER_WIDTH };
