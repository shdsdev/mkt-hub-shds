"use client";

export type ThemeRevealOrigin = { x: number; y: number };

const THEME_SURFACES = {
  carbon: "#f4f3ef",
  "lark-orange": "#080909",
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildThemeRevealPath(
  progress: number,
  origin: ThemeRevealOrigin,
  width: number,
  height: number,
): string {
  const p = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const x = clamp(Number.isFinite(origin.x) ? origin.x : safeWidth / 2, 0, safeWidth);
  const y = clamp(Number.isFinite(origin.y) ? origin.y : safeHeight / 2, 0, safeHeight);
  const reach = Math.hypot(Math.max(x, safeWidth - x), Math.max(y, safeHeight - y)) / 0.72;
  const points = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI) / 6;
    const radius = reach * p * (1 + 0.12 * Math.sin(angle * 3 + p * 0.65) + 0.065 * Math.cos(angle * 5 - p * 0.35));
    return { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
  });
  const format = (value: number) => Number(value.toFixed(2));
  let path = `M${format(points[0].x)} ${format(points[0].y)}`;

  for (let index = 0; index < points.length; index += 1) {
    const before = points[(index + points.length - 1) % points.length];
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const after = points[(index + 2) % points.length];
    path += `C${format(start.x + (end.x - before.x) / 6)} ${format(start.y + (end.y - before.y) / 6)} ${format(end.x - (after.x - start.x) / 6)} ${format(end.y - (after.y - start.y) / 6)} ${format(end.x)} ${format(end.y)}`;
  }

  return `${path}Z`;
}

export function startThemeReveal(themeId: string, trigger: HTMLElement): void {
  if (typeof document === "undefined") return;

  if (!THEME_SURFACES[themeId as keyof typeof THEME_SURFACES]) return;

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targetIsDark = themeId === "lark-orange";
  const bounds = trigger.getBoundingClientRect();
  const origin = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  const applyTheme = () => {
    root.dataset.appTheme = themeId;
    root.classList.toggle("dark", targetIsDark);
  };

  const startViewTransition = (document as Document & {
    startViewTransition?: (callback: () => void) => { ready: Promise<void>; finished: Promise<void> };
  }).startViewTransition;
  if (reducedMotion || !startViewTransition) {
    applyTheme();
    return;
  }

  root.dataset.themeReveal = "active";
  root.style.setProperty("--theme-reveal-x", `${origin.x}px`);
  root.style.setProperty("--theme-reveal-y", `${origin.y}px`);
  let cleanupTimer = 0;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.clearTimeout(cleanupTimer);
    delete root.dataset.themeReveal;
    root.style.removeProperty("--theme-reveal-x");
    root.style.removeProperty("--theme-reveal-y");
  };
  let transition: { finished: Promise<void> };
  try {
    transition = startViewTransition.call(document, applyTheme);
  } catch {
    applyTheme();
    cleanup();
    return;
  }

  cleanupTimer = window.setTimeout(cleanup, 1300);
  void transition.finished.then(cleanup, cleanup);
}
