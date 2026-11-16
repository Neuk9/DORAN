export const SCALES = ["1", "1.15", "1.3"] as const;
export type FontScale = (typeof SCALES)[number];

export function nextScale(current: string): FontScale {
  const index = SCALES.indexOf(current as FontScale);
  return SCALES[(index + 1) % SCALES.length];
}

export function applyScale(scale: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--font-scale", scale);
  localStorage.setItem("font-scale", scale);
}
