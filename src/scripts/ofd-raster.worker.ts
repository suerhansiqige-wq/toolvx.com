/**
 * OFD raster Worker — CPU-bound canvas stitching and blob export off the main thread.
 * Keeps the UI responsive during long-image merge and large PNG encoding.
 */

type StitchRequest = {
  id: number;
  type: "stitchLongImage";
  widths: number[];
  heights: number[];
  gap: number;
  maxDim: number;
  buffers: ArrayBuffer[];
};

type CanvasBlobRequest = {
  id: number;
  type: "canvasToPng";
  width: number;
  height: number;
  buffer: ArrayBuffer;
};

type WorkerRequest = StitchRequest | CanvasBlobRequest;

type WorkerResponse =
  | { id: number; ok: true; buffer: ArrayBuffer }
  | { id: number; ok: false; error: string };

async function stitchLongImageToPng(
  widths: number[],
  heights: number[],
  gap: number,
  maxDim: number,
  buffers: ArrayBuffer[]
): Promise<ArrayBuffer> {
  if (buffers.length === 0) throw new Error("no-pages");

  let width = Math.max(...widths);
  let totalHeight = heights.reduce((sum, h) => sum + h, 0) + gap * (heights.length - 1);
  const scale = Math.min(1, maxDim / width, maxDim / totalHeight);

  const outW = Math.max(1, Math.floor(width * scale));
  const outH = Math.max(1, Math.floor(totalHeight * scale));

  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);

  let y = 0;
  for (let i = 0; i < buffers.length; i++) {
    const srcW = widths[i];
    const srcH = heights[i];
    const imageData = new ImageData(new Uint8ClampedArray(buffers[i]), srcW, srcH);
    const pageCanvas = new OffscreenCanvas(srcW, srcH);
    const pageCtx = pageCanvas.getContext("2d");
    if (!pageCtx) continue;
    pageCtx.putImageData(imageData, 0, 0);

    const drawW = Math.floor(srcW * scale);
    const drawH = Math.floor(srcH * scale);
    const x = Math.floor((outW - drawW) / 2);
    ctx.drawImage(pageCanvas, x, y, drawW, drawH);
    y += drawH + Math.floor(gap * scale);
  }

  const pngBlob = await canvas.convertToBlob({ type: "image/png" });
  return pngBlob.arrayBuffer();
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === "stitchLongImage") {
      const buffer = await stitchLongImageToPng(
        msg.widths,
        msg.heights,
        msg.gap,
        msg.maxDim,
        msg.buffers
      );
      const response: WorkerResponse = { id: msg.id, ok: true, buffer };
      self.postMessage(response, { transfer: [buffer] });
      return;
    }

    if (msg.type === "canvasToPng") {
      const imageData = new ImageData(
        new Uint8ClampedArray(msg.buffer),
        msg.width,
        msg.height
      );
      const canvas = new OffscreenCanvas(msg.width, msg.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas-context");
      ctx.putImageData(imageData, 0, 0);
      const pngBlob = await canvas.convertToBlob({ type: "image/png" });
      const buffer = await pngBlob.arrayBuffer();
      const response: WorkerResponse = { id: msg.id, ok: true, buffer };
      self.postMessage(response, { transfer: [buffer] });
      return;
    }

    throw new Error("unknown-task");
  } catch (error) {
    const response: WorkerResponse = {
      id: msg.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
