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

function applyOverlayStyles(el: HTMLElement): void {
  Object.assign(el.style, {
    position: "fixed",
    top: "0",
    right: "0",
    bottom: "0",
    left: "0",
    zIndex: "100",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    cursor: "zoom-out",
  });
}

function applyImageStyles(el: HTMLImageElement): void {
  Object.assign(el.style, {
    maxWidth: "100%",
    maxHeight: "90vh",
    objectFit: "contain",
    cursor: "default",
  });
}

function applyCloseButtonStyles(el: HTMLButtonElement): void {
  Object.assign(el.style, {
    position: "absolute",
    top: "1rem",
    right: "1rem",
    borderRadius: "0.5rem",
    padding: "0.5rem",
    fontSize: "1.5rem",
    lineHeight: "1",
    color: "#fff",
    background: "transparent",
    border: "none",
    cursor: "pointer",
  });
}

export function openImageLightbox(
  src: string,
  alt: string,
  trigger?: HTMLElement | null
): void {
  closeImageLightbox();
  lastFocused = trigger ?? document.activeElement;

  overlay = document.createElement("div");
  overlay.className = "image-lightbox-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute(
    "aria-label",
    alt ? t("image_preview_alt", { alt }) : t("image_preview")
  );
  applyOverlayStyles(overlay);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "image-lightbox-overlay__close";
  closeButton.setAttribute("aria-label", t("close_preview"));
  closeButton.textContent = "×";
  applyCloseButtonStyles(closeButton);
  closeButton.addEventListener("click", closeImageLightbox);

  const image = document.createElement("img");
  image.src = src;
  image.alt = alt;
  image.className = "image-lightbox-overlay__image";
  image.draggable = false;
  applyImageStyles(image);

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
