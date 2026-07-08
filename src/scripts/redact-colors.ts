/** Preset fill colors for the redaction palette (16×10 grid). */
export const REDACT_PALETTE: string[] = (() => {
  const colors: string[] = [
    "#000000",
    "#ffffff",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
    "#00ffff",
    "#808080",
    "#c0c0c0",
    "#800000",
    "#008000",
    "#000080",
    "#808000",
    "#800080",
    "#008080",
  ];
  const steps = [0, 17, 34, 51, 68, 85, 102, 119, 136, 153, 170, 187, 204, 221, 238, 255];
  for (const r of steps) {
    for (const g of steps) {
      const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${((r + g) % 256).toString(16).padStart(2, "0")}`;
      if (!colors.includes(hex) && colors.length < 160) colors.push(hex);
    }
  }
  while (colors.length < 160) {
    const i = colors.length;
    const v = Math.floor((i * 37) % 256);
    colors.push(
      `#${v.toString(16).padStart(2, "0")}${((v + 85) % 256).toString(16).padStart(2, "0")}${((v + 170) % 256).toString(16).padStart(2, "0")}`
    );
  }
  return colors.slice(0, 160);
})();
