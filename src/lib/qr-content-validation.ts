export function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeInternationalPhone(value: string) {
  return value.replace(/\D/g, "");
}

export function isInternationalPhone(value: string) {
  const trimmed = value.trim();
  const digits = normalizeInternationalPhone(trimmed);
  return /^\+[0-9\s().-]+$/.test(trimmed) && digits.length >= 7 && digits.length <= 15;
}
