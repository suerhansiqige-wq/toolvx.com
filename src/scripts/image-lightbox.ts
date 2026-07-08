import { t } from "@/scripts/i18n-client";

let overlay: HTMLElement | null = null;
let lastFocused: Element | null = null;

export function closeImageLightbox(): void {
  overlay?.remove();
  overlay = null;
  if (lastFocused instanceof HTMLElement) {
    lastFocused.focus();
  }
  lastFocused = null;
}

export function openImageLightbox(
  src: string,
  alt: string,
  trigger?: HTMLElement | null
): void {
  closeImageLightbox();
  lastFocused = trigger ?? document.activeElement;

  overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute(
    "aria-label",
    alt ? t("image_preview_alt", { alt }) : t("image_preview")
  );
  overlay.className =
    "fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/75 p-4 backdrop-blur-sm";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", t("close_preview"));
  closeButton.className =
    "absolute end-4 top-4 rounded-lg p-2 text-2xl leading-none text-white transition hover:bg-white/10";
  closeButton.textContent = "×";
  closeButton.addEventListener("click", closeImageLightbox);

  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  image.className = "max-h-[90dvh] max-w-full cursor-default object-contain";
  image.draggable = false;

  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeImageLightbox();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeImageLightbox();
  };
  document.addEventListener("keydown", onKeyDown, { once: true });

  overlay.append(closeButton, image);
  document.body.appendChild(overlay);
  closeButton.focus();
}
