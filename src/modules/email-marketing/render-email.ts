import { parseEmailContentDocument, type EmailContentDocument } from "./content-schema";

export type EmailPersonalization = {
  first_name?: string | null;
  event_name?: string | null;
  event_date?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function renderText(value: string): string {
  return escapeHtml(value).replaceAll("\n", "<br />");
}

function renderBlock(
  block: EmailContentDocument["blocks"][number],
  personalization: EmailPersonalization,
): string {
  switch (block.type) {
    case "text":
      return `<p style="margin:0 0 16px;line-height:1.6">${renderText(block.text)}</p>`;
    case "image": {
      const src = safeHttpsUrl(block.src);
      return src
        ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}" style="display:block;max-width:100%;height:auto" />`
        : "";
    }
    case "button": {
      const href = safeHttpsUrl(block.href);
      return href
        ? `<p style="margin:0 0 16px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 18px;background:#ff6f2c;color:#fff;text-decoration:none;border-radius:8px">${renderText(block.label)}</a></p>`
        : "";
    }
    case "divider":
      return `<hr style="border:0;border-top:1px solid #d7dce2;margin:20px 0" />`;
    case "columns":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${block.columns
        .map((column) => `<td valign="top" style="padding:0 8px 16px 0">${renderText(column)}</td>`)
        .join("")}</tr></table>`;
    case "variable": {
      const value = personalization[block.name] ?? block.fallback;
      return `<span>${renderText(value ?? "")}</span>`;
    }
  }
}

export function renderEmailHtml(
  input: unknown,
  personalization: EmailPersonalization = {},
): string {
  const document = parseEmailContentDocument(input);
  const body = document.blocks.map((block) => renderBlock(block, personalization)).join("");

  return `<!doctype html><html><body style="margin:0;background:#f5f7fa;color:#1d2430;font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto;padding:32px 20px;background:#fff">${body}</main></body></html>`;
}
