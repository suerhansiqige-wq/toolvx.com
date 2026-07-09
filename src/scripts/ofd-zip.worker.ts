/**
 * OFD ZIP 操作 Worker — 合并 / 压缩 / 文本提取在后台线程执行
 */
import {
  compressOfdBuffer,
  extractOfdTextFromBuffer,
  mergeOfdBuffers,
} from "./ofd-zip-ops";

type WorkerRequest =
  | { id: number; type: "compress"; buffer: ArrayBuffer }
  | { id: number; type: "merge"; buffers: ArrayBuffer[] }
  | { id: number; type: "extractText"; buffer: ArrayBuffer };

type WorkerResponse =
  | { id: number; ok: true; buffer?: ArrayBuffer; text?: string }
  | { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === "compress") {
      const buffer = await compressOfdBuffer(msg.buffer);
      const response: WorkerResponse = { id: msg.id, ok: true, buffer };
      self.postMessage(response, { transfer: [buffer] });
      return;
    }
    if (msg.type === "merge") {
      const buffer = await mergeOfdBuffers(msg.buffers);
      const response: WorkerResponse = { id: msg.id, ok: true, buffer };
      self.postMessage(response, { transfer: [buffer] });
      return;
    }
    if (msg.type === "extractText") {
      const text = await extractOfdTextFromBuffer(msg.buffer);
      const response: WorkerResponse = { id: msg.id, ok: true, text };
      self.postMessage(response);
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
