const fullDocumentPattern = /<body\b[^>]*>([\s\S]*?)<\/body>/i;

export function extractEmailBodyHtml(source: string): string {
  return source.match(fullDocumentPattern)?.[1].trim() ?? source.trim();
}

export function isCompleteEmailDocument(source: string): boolean {
  return /<html\b/i.test(source) || /<!doctype\s+html/i.test(source);
}

export function createEmailPreviewDocument(source: string): string {
  if (/<html\b/i.test(source) || /<!doctype\b/i.test(source)) return source;

  return `<!doctype html><html><body style="margin:0;background:#f5f7fa;color:#1d2430;font-family:Arial,sans-serif">${source}</body></html>`;
}

export function getEmailPreviewWidth(device: "desktop" | "mobile"): number | "100%" {
  return device === "mobile" ? 390 : "100%";
}
