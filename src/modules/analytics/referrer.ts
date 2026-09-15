// A raw Referer header is a full URL ("https://l.instagram.com/?u=..."); only the hostname is
// stored — not the full URL (privacy/prolixity, and matches how the dashboard groups by domain,
// not by exact page). A malformed or absent header returns undefined, same as each other, so the
// caller never needs to distinguish "missing" from "unparseable".
export function normalizeReferrer(rawHeader: string | null): string | undefined {
  if (!rawHeader) return undefined;
  try {
    return new URL(rawHeader).hostname || undefined;
  } catch {
    return undefined;
  }
}
