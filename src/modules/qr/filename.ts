const MAX_BASENAME_LENGTH = 60;

function collapseDashes(value: string): string {
  return value.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
}

// Turns a QR code's human-friendly name into a safe, lowercase file base name for downloads
// ("FT Bodallas QR" -> "ft-bodallas-qr"). Falls back to qr-<id> when nothing usable survives
// sanitization, and caps the length so the served filename never explodes the Content-Disposition
// header. Content-Disposition filename tokens must not contain quotes, CR/LF, or path separators,
// which is why everything but [a-z0-9] collapses to a dash.
export function qrDownloadFilename(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-");

  const slug = collapseDashes(base).slice(0, MAX_BASENAME_LENGTH).replace(/-+$/, "");
  return slug.length > 0 ? slug : `qr-${id}`;
}