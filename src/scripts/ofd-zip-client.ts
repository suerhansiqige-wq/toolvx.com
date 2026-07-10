/**
 * OFD ZIP Worker 客户端 — 自动降级到主线程
 */
import {
  compressOfdBuffer,
  extractOfdTextFromBuffer,
  mergeOfdBuffers,
} from "@/scripts/ofd-zip-ops";

type WorkerResponse =
  | { id: number; ok: true; buffer?: ArrayBuffer; text?: string }
  | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<
  number,
  { resolve: (value: WorkerResponse) => void; reject: (reason: Error) => void }
>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./ofd-zip.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const handler = pending.get(msg.id);
      if (!handler) return;
      pending.delete(msg.id);
      if (msg.ok) handler.resolve(msg);
      else handler.reject(new Error(msg.error));
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

function runInWorker<T extends WorkerResponse>(payload: object): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.reject(new Error("worker-unavailable"));

  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: value => resolve(value as T),
      reject,
    });
    w.postMessage({ id, ...payload });
  });
}

export async function compressOfdInWorker(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const res = await runInWorker<{ id: number; ok: true; buffer: ArrayBuffer }>({
      type: "compress",
      buffer,
    });
    if (!res.buffer) throw new Error("compress-failed");
    return res.buffer;
  } catch {
    return compressOfdBuffer(buffer);
  }
}

export async function mergeOfdInWorker(buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  try {
    const res = await runInWorker<{ id: number; ok: true; buffer: ArrayBuffer }>({
      type: "merge",
      buffers,
    });
    if (!res.buffer) throw new Error("merge-failed");
    return res.buffer;
  } catch {
    return mergeOfdBuffers(buffers);
  }
}

export async function extractOfdTextInWorker(buffer: ArrayBuffer): Promise<string> {
  try {
    const res = await runInWorker<{ id: number; ok: true; text: string }>({
      type: "extractText",
      buffer,
    });
    return res.text ?? "";
  } catch {
    return extractOfdTextFromBuffer(buffer);
  }
}

export function terminateOfdZipWorker(): void {
  for (const [, handler] of pending) handler.reject(new Error("worker-terminated"));
  pending.clear();
  worker?.terminate();
  worker = null;
}
