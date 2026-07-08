/** Resolution-aware layout max width (updates --layout-max-width / --layout-gutter). */

type LayoutTier = "sm" | "md" | "lg" | "xl" | "2k" | "4k";

function resolveTier(viewportWidth: number, screenWidth: number): LayoutTier {
  const reference = Math.max(viewportWidth, screenWidth);

  if (reference >= 2560) return "4k";
  if (reference >= 1920) return "2k";
  if (reference >= 1536) return "xl";
  if (reference >= 1280) return "lg";
  if (reference >= 1024) return "md";
  return "sm";
}

function computeLayoutWidth(viewportWidth: number, screenWidth: number) {
  const tier = resolveTier(viewportWidth, screenWidth);
  const gutter =
    tier === "4k" ? 80 : tier === "2k" ? 64 : tier === "xl" ? 56 : tier === "lg" ? 48 : tier === "md" ? 40 : 32;

  const cap =
    tier === "4k"
      ? 1920
      : tier === "2k"
        ? 1680
        : tier === "xl"
          ? 1440
          : tier === "lg"
            ? 1280
            : tier === "md"
              ? 1152
              : viewportWidth;

  const fluid = Math.floor(viewportWidth * (tier === "4k" ? 0.78 : tier === "2k" ? 0.84 : 0.9));
  const max = Math.min(cap, fluid, viewportWidth - gutter);

  return {
    tier,
    maxWidth: Math.max(320, max),
    gutter: Math.min(gutter / 2, Math.max(16, viewportWidth * 0.04)),
  };
}

export function updateLayoutWidth() {
  const viewportWidth = window.innerWidth;
  const screenWidth = window.screen?.width ?? viewportWidth;
  const { tier, maxWidth, gutter } = computeLayoutWidth(viewportWidth, screenWidth);
  const root = document.documentElement;

  root.dataset.layoutTier = tier;
  root.style.setProperty("--layout-max-width", `${maxWidth}px`);
  root.style.setProperty("--layout-gutter", `${gutter}px`);
}

export function initLayoutWidth() {
  updateLayoutWidth();

  let frame = 0;
  const onResize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateLayoutWidth);
  };

  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("orientationchange", onResize, { passive: true });
  document.addEventListener("astro:page-load", updateLayoutWidth);
}

initLayoutWidth();
