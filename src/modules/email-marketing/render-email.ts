import sanitizeHtml from "sanitize-html";
import juice from "juice";
import {
  emailContentBlockSchema,
  parseEmailCampaignContent,
  type EmailContentDocument,
} from "./content-schema";
import { extractEmailBodyHtml, isCompleteEmailDocument } from "@/lib/email-source";

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

function renderBlockStyle(style: EmailContentDocument["blocks"][number]["style"]): string {
  const declarations = [
    style.backgroundColor ? `background-color:${style.backgroundColor}` : "",
    style.color ? `color:${style.color}` : "",
    style.padding !== undefined ? `padding:${style.padding}px` : "",
    style.align ? `text-align:${style.align}` : "",
  ].filter(Boolean);
  return declarations.join(";");
}

const CSS_LENGTH = "(?:0|[\\d.]+(?:px|em|rem|%|vw|vh))";
const CSS_BOX_LENGTHS = new RegExp(`^(?:${CSS_LENGTH}|auto)(?:\\s+(?:${CSS_LENGTH}|auto)){0,3}$`, "i");
const CSS_ANY_LENGTH = new RegExp(`^(?:${CSS_LENGTH}|auto|inherit|initial|unset|none)(?:\\s+[^;]+)?$`, "i");

const emailBodySanitizerOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "a", "b", "body", "br", "button", "center", "div", "em", "footer", "h1", "h2", "h3", "head", "hr", "html", "i", "img", "li",
    "main", "meta", "ol", "p", "span", "strong", "style", "table", "tbody", "td", "tfoot", "th", "thead", "title", "tr", "u", "ul",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    "*": ["align", "alt", "border", "cellpadding", "cellspacing", "class", "dir", "height", "lang", "role", "src", "style", "title", "valign", "width", "xmlns"],
  },
  allowedSchemes: ["https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  disallowedTagsMode: "discard",
  parseStyleAttributes: true,
  allowedStyles: {
    "*": {
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i],
      "background": [/^[#\w .(),%/-]+$/i],
      "border": [/^[#\w .(),-]+$/i],
      "border-bottom": [/^[#\w .(),-]+$/i],
      "border-collapse": [/^(collapse|separate)$/i],
      "border-spacing": [/^[\d.]+(px|em|rem|%)?(\s+[\d.]+(px|em|rem|%)?)?$/i],
      "border-radius": [/^[\d.]+(px|%)$/i],
      "border-top": [/^[#\w .(),-]+$/i],
      "box-sizing": [/^(border-box|content-box)$/i],
      "color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i, /^rgba\(/i, /^[a-z]+$/i],
      "display": [/^[a-z-]+$/i],
      "flex": [/^[\w .%()-]+$/i],
      "flex-direction": [/^(row|row-reverse|column|column-reverse)$/i],
      "flex-wrap": [/^(nowrap|wrap|wrap-reverse)$/i],
      "gap": [CSS_BOX_LENGTHS],
      "font": [/^[\w\s,."'/-]+$/i],
      "font-family": [/^[\w ,"'-]+$/i],
      "font-style": [/^(normal|italic|oblique)$/i],
      "font-size": [/^[\d.]+(px|em|rem|%)$/i],
      "font-weight": [/^(normal|bold|[1-9]00)$/i],
      "letter-spacing": [/^-?[\d.]+(px|em|rem|%)$/i],
      "height": [/^[\d.]+(px|%)$/i],
      "line-height": [/^[\d.]+(px|em|rem|%)?$/i],
      "margin": [CSS_BOX_LENGTHS],
      "margin-bottom": [CSS_BOX_LENGTHS],
      "margin-left": [CSS_BOX_LENGTHS],
      "margin-right": [CSS_BOX_LENGTHS],
      "margin-top": [CSS_BOX_LENGTHS],
      "max-height": [CSS_ANY_LENGTH],
      "max-width": [CSS_ANY_LENGTH],
      "min-height": [CSS_ANY_LENGTH],
      "min-width": [CSS_ANY_LENGTH],
      "opacity": [/^(0|0?\.\d+|1)$/i],
      "overflow": [/^(hidden|visible|auto|scroll)$/i],
      "padding": [CSS_BOX_LENGTHS],
      "padding-bottom": [CSS_BOX_LENGTHS],
      "padding-left": [CSS_BOX_LENGTHS],
      "padding-right": [CSS_BOX_LENGTHS],
      "padding-top": [CSS_BOX_LENGTHS],
      "position": [/^(static|relative|absolute|fixed|sticky)$/i],
      "justify-content": [/^(start|end|center|flex-start|flex-end|space-between|space-around|space-evenly)$/i],
      "align-items": [/^(start|end|center|flex-start|flex-end|stretch|baseline)$/i],
      "text-align": [/^(left|center|right|justify)$/i],
      "text-decoration": [/^[a-z -]+$/i],
      "text-transform": [/^(none|uppercase|lowercase|capitalize)$/i],
      "vertical-align": [/^(top|middle|bottom|baseline)$/i],
      "white-space": [/^(normal|nowrap|pre|pre-wrap|pre-line)$/i],
      "width": [CSS_ANY_LENGTH],
      "word-break": [/^(normal|break-all|keep-all|break-word)$/i],
      "overflow-wrap": [/^(normal|break-word|anywhere)$/i],
    },
  },
};

const emailDocumentSanitizerOptions: sanitizeHtml.IOptions = {
  ...emailBodySanitizerOptions,
  enforceHtmlBoundary: true,
};

function sanitizeStyleBlocks(source: string): string {
  return source.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open: string, css: string, close: string) => {
    const safeCss = css
      .replace(/@import\s+[^;]+;?/gi, "")
      .replace(/(?:expression|javascript|vbscript|behavior|-moz-binding)\s*:/gi, "");
    return `${open}${safeCss}${close}`;
  });
}

function normalizeEmailDocumentSource(source: string): string {
  const trimmed = source.trim();
  const documentStart = trimmed.search(/(?:<!doctype\s+html|<html\b)/i);
  return documentStart > 0 ? trimmed.slice(documentStart) : trimmed;
}

export function sanitizeEmailBodyHtml(bodyHtml: string): string {
  return sanitizeHtml(bodyHtml, emailBodySanitizerOptions);
}

function renderHtmlBody(bodyHtml: string, personalization: EmailPersonalization): string {
  const personalized = extractEmailBodyHtml(bodyHtml).replace(/\{\{(first_name|event_name|event_date)\}\}/g, (_, name: keyof EmailPersonalization) =>
    renderText(personalization[name] ?? ""),
  );
  return sanitizeEmailBodyHtml(personalized);
}

function renderHtmlDocument(source: string, personalization: EmailPersonalization): string {
  const normalizedSource = normalizeEmailDocumentSource(source);
  const personalized = sanitizeStyleBlocks(normalizedSource).replace(/\{\{(first_name|event_name|event_date)\}\}/g, (_, name: keyof EmailPersonalization) =>
    renderText(personalization[name] ?? ""),
  );
  const sanitized = sanitizeHtml(personalized, emailDocumentSanitizerOptions);
  const inlined = juice(sanitized, {
    applyHeightAttributes: true,
    applyWidthAttributes: true,
    preserveFontFaces: true,
    preserveImportant: true,
    preserveMediaQueries: true,
    removeStyleTags: false,
  });
  return `<!doctype html>${inlined}`;
}

function renderBlock(
  block: EmailContentDocument["blocks"][number],
  personalization: EmailPersonalization,
): string {
  switch (block.type) {
    case "text":
      return `<p style="margin:0 0 16px;line-height:1.6${renderBlockStyle(block.style) ? `;${renderBlockStyle(block.style)}` : ""}">${renderText(block.text)}</p>`;
    case "heading": {
      const Tag = block.level;
      return `<${Tag} style="margin:0 0 16px;font-size:${block.level === "h1" ? 32 : block.level === "h2" ? 26 : 20}px;line-height:1.2${renderBlockStyle(block.style) ? `;${renderBlockStyle(block.style)}` : ""}">${renderText(block.text)}</${Tag}>`;
    }
    case "image": {
      const src = safeHttpsUrl(block.src);
      return src
         ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}" style="display:block;max-width:100%;height:auto${renderBlockStyle(block.style) ? `;${renderBlockStyle(block.style)}` : ""}" />`
        : "";
    }
    case "button": {
      const href = safeHttpsUrl(block.href);
      return href
         ? `<p style="margin:0 0 16px${renderBlockStyle(block.style) ? `;${renderBlockStyle(block.style)}` : ""}"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 18px;background:#ff6f2c;color:#fff;text-decoration:none;border-radius:8px">${renderText(block.label)}</a></p>`
        : "";
    }
    case "divider":
      return `<hr style="border:0;border-top:1px solid #d7dce2;margin:20px 0${renderBlockStyle(block.style) ? `;${renderBlockStyle(block.style)}` : ""}" />`;
    case "spacer":
      return `<div style="height:${block.height}px;line-height:${block.height}px;font-size:1px${renderBlockStyle(block.style) ? `;${renderBlockStyle(block.style)}` : ""}">&nbsp;</div>`;
    case "logo": {
      const src = safeHttpsUrl(block.src);
      return src
        ? `<p style="margin:0 0 16px${renderBlockStyle(block.style) ? `;${renderBlockStyle(block.style)}` : ""}"><img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}" style="display:inline-block;max-width:100%;height:auto" /></p>`
        : "";
    }
    case "social":
      return `<p style="margin:0 0 16px${renderBlockStyle(block.style) ? `;${renderBlockStyle(block.style)}` : ""}">${block.links
        .map((link) => {
          const href = safeHttpsUrl(link.href);
          return href ? `<a href="${escapeHtml(href)}" style="margin-right:12px;color:#ff6f2c">${renderText(link.label)}</a>` : "";
        })
        .join("")}</p>`;
    case "html":
      return sanitizeEmailBodyHtml(block.html);
    case "columns":
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${block.columns
        .map((column) => {
          if (typeof column === "string") return `<td valign="top" style="padding:0 8px 16px 0">${renderText(column)}</td>`;
          const nestedBlocks = Array.isArray(column.blocks)
            ? column.blocks.map((nestedBlock) => renderBlock(emailContentBlockSchema.parse(nestedBlock), personalization)).join("")
            : "";
          return `<td valign="top" style="padding:0 8px 16px 0">${nestedBlocks}</td>`;
        })
        .join("")}</tr></table>`;
    case "variable": {
      const value = personalization[block.name] ?? block.fallback;
        return `<span style="${renderBlockStyle(block.style)}">${renderText(value ?? "")}</span>`;
    }
  }
}

export function renderEmailHtml(
  input: unknown,
  personalization: EmailPersonalization = {},
): string {
  const document = parseEmailCampaignContent(input);
  if (document.mode === "html" && isCompleteEmailDocument(document.bodyHtml)) {
    return renderHtmlDocument(document.bodyHtml, personalization);
  }

  const body = document.mode === "html"
    ? renderHtmlBody(document.bodyHtml, personalization)
    : document.blocks.map((block) => renderBlock(block, personalization)).join("");

  return `<!doctype html><html><body style="margin:0;background:#f5f7fa;color:#1d2430;font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto;padding:32px 20px;background:#fff">${body}</main><footer style="max-width:640px;margin:0 auto;padding:16px 20px;text-align:center;font:12px Arial,sans-serif;color:#667085"><a href="{{unsubscribe_url}}" style="color:#667085">Darse de baja</a></footer></body></html>`;
}
