/**
 * OFD raster Worker client — long-image stitching with main-thread fallback.
 */

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (buffer: ArrayBuffer) => void; reject: (reason: Error) => void }
>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return null;
  }
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./ofd-raster.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; buffer?: ArrayBuffer; error?: string }>) => {
      const msg = event.data;
      const handler = pending.get(msg.id);
      if (!handler) return;
      pending.delete(msg.id);
      if (msg.ok && msg.buffer) handler.resolve(msg.buffer);
      else handler.reject(new Error(msg.error ?? "raster-worker-failed"));
    };
    worker.onerror = () => {
      workerBroken = true;
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function runInWorker(bufferPayload: object, transfer: Transferable[] = []): Promise<ArrayBuffer> {
  const w = getWorker();
  if (!w) return Promise.reject(new Error("raster-worker-unavailable"));

  const id = ++seq;
  return new Promise<ArrayBuffer>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, ...bufferPayload }, transfer);
  });
}

export async function stitchLongImageInWorker(
  canvases: HTMLCanvasElement[],
  gap: number,
  maxDim: number
): Promise<Blob> {
  const widths: number[] = [];
  const heights: number[] = [];
  const buffers: ArrayBuffer[] = [];

  for (const canvas of canvases) {
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    widths.push(canvas.width);
    heights.push(canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    buffers.push(imageData.data.buffer.slice(0));
  }

  if (buffers.length === 0) throw new Error("no-pages");

  try {
    const pngBuffer = await runInWorker(
      { type: "stitchLongImage", widths, heights, gap, maxDim, buffers },
      buffers
    );
    return new Blob([pngBuffer], { type: "image/png" });
  } catch {
    return stitchLongImageMainThread(canvases, gap, maxDim);
  }
}

function stitchLongImageMainThread(
  canvases: HTMLCanvasElement[],
  gap: number,
  maxDim: number
): Promise<Blob> {
  let width = Math.max(...canvases.map(c => c.width));
  let totalHeight = canvases.reduce((sum, c) => sum + c.height, 0) + gap * (canvases.length - 1);
  const scale = Math.min(1, maxDim / width, maxDim / totalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(totalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas-context"));

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = 0;
  for (const page of canvases) {
    const drawW = Math.floor(page.width * scale);
    const drawH = Math.floor(page.height * scale);
    const x = Math.floor((canvas.width - drawW) / 2);
    ctx.drawImage(page, x, y, drawW, drawH);
    y += drawH + Math.floor(gap * scale);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => {
      canvas.width = 0;
      canvas.height = 0;
      if (b) resolve(b);
      else reject(new Error("png-failed"));
    }, "image/png");
  });
}

export function terminateOfdRasterWorker(): void {
  for (const [, handler] of pending) handler.reject(new Error("raster-worker-terminated"));
  pending.clear();
  worker?.terminate();
  worker = null;
}
