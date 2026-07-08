/** Re-sync sidebar column width after i18n swaps longer/shorter labels. */

const HOVER_SLACK = 14;

export function syncToolSidebarWidth(root: ParentNode = document): void {
  const nav = root.querySelector<HTMLElement>(".tool-sidebar-nav");
  if (!nav) return;

  nav.style.removeProperty("width");
  nav.style.width = "max-content";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const measureTargets = nav.querySelectorAll<HTMLElement>(
        ".tool-sidebar-nav__link"
      );

      let maxContent = 0;
      for (const el of measureTargets) {
        maxContent = Math.max(maxContent, el.scrollWidth);
      }

      const styles = getComputedStyle(nav);
      const extra = parseFloat(styles.getPropertyValue("--tool-sidebar-width-extra"));
      const bump = Number.isFinite(extra) ? extra : 24;

      if (maxContent > 0) {
        nav.style.width = `${Math.ceil(maxContent + bump + HOVER_SLACK)}px`;
      }
    });
  });
}
