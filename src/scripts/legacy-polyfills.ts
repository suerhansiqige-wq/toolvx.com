/**
 * Runtime polyfills for Win7 / Chrome < 119.
 * Safe to call multiple times; also runs on first import.
 */
export function applyLegacyPolyfills(): void {
  if (typeof globalThis === "undefined") {
    (window as unknown as { globalThis: typeof window }).globalThis = window;
  }

  if (typeof Promise.withResolvers !== "function") {
    Promise.withResolvers = function withResolvers<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  if (!Array.prototype.at) {
    Object.defineProperty(Array.prototype, "at", {
      value: function at<T>(this: T[], index: number): T | undefined {
        const len = this.length;
        const relative = index >= 0 ? index : len + index;
        if (relative < 0 || relative >= len) return undefined;
        return this[relative];
      },
      writable: true,
      configurable: true,
    });
  }

  if (!String.prototype.replaceAll) {
    Object.defineProperty(String.prototype, "replaceAll", {
      value: function replaceAll(
        this: string,
        search: string | RegExp,
        replacement: string
      ): string {
        if (search instanceof RegExp) {
          if (!search.global) {
            throw new TypeError("replaceAll requires a global RegExp");
          }
          return this.replace(search, replacement);
        }
        return this.split(search).join(replacement);
      },
      writable: true,
      configurable: true,
    });
  }
}

applyLegacyPolyfills();
