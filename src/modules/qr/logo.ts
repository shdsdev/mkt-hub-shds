export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

// Standard industry safe zone — beyond this, a logo starts occluding enough of the QR to break
// scannability even at error-correction level H.
export const LOGO_SAFE_ZONE_RATIO = 0.22;

export function computeLogoDimensions(qrSizePx: number): { width: number; height: number } {
  const size = Math.round(qrSizePx * LOGO_SAFE_ZONE_RATIO);
  return { width: size, height: size };
}

// A logo forces the highest error-correction level regardless of what was requested — legibility
// rule from docs/superpowers/specs/2026-09-09-phase5-qr-generator-design.md.
export function resolveErrorCorrectionLevel(
  requested: ErrorCorrectionLevel,
  hasLogo: boolean,
): ErrorCorrectionLevel {
  return hasLogo ? "H" : requested;
}
