/** 性能与内存工具 — 供 OFD 渲染管线复用 */

/** 将控制权交还主线程，避免低配设备长时间假死 */
export function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 32 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** 根据 CPU / 内存粗略降级渲染宽度，减轻 Canvas 压力 */
export function getAdaptiveRenderWidth(base = 794): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (cores <= 2 || mem <= 2) return Math.min(base, 560);
  if (cores <= 4 || mem <= 4) return Math.min(base, 680);
  return base;
}

/** html2canvas 缩放：旧设备用 1，避免 4K Canvas 撑爆内存 */
export function getAdaptiveCanvasScale(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  if (cores <= 2 || mem <= 2) return 1;
  if (cores <= 4 || mem <= 4) return Math.min(1.25, window.devicePixelRatio || 1);
  return Math.max(1, window.devicePixelRatio || 1);
}

/** 释放 Canvas 占用的 GPU/内存缓冲区 */
export function releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
}

export function releaseCanvases(canvases: HTMLCanvasElement[]): void {
  for (const canvas of canvases) releaseCanvas(canvas);
}

/** 统一管理 Blob URL，防止重复创建与泄漏 */
export class BlobUrlRegistry {
  private readonly urls = new Set<string>();

  create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }

  revoke(url: string | null | undefined): void {
    if (!url || !this.urls.has(url)) return;
    URL.revokeObjectURL(url);
    this.urls.delete(url);
  }

  revokeAll(): void {
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

/**
 * 兼容性更好的下载触发：
 * - 优先 <a download>
 * - 失败时尝试 msSaveOrOpenBlob（IE / 旧 Edge）
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const registry = new BlobUrlRegistry();
  const url = registry.create(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  const nav = window.navigator as Navigator & {
    msSaveOrOpenBlob?: (blob: Blob, name: string) => boolean;
  };
  if (!anchor.download && nav.msSaveOrOpenBlob) {
    nav.msSaveOrOpenBlob(blob, filename);
  }

  setTimeout(() => registry.revoke(url), 60_000);
}
