// Shared normalization used by browser parsing and server-side UTM persistence.
export function normalizeUtmValue(raw: string): string {
  if (raw.length > 255) {
    throw new Error("El valor UTM debe tener 255 caracteres o menos.");
  }

  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length === 0) {
    throw new Error("UTM value must contain at least one letter or digit.");
  }

  return normalized;
}
