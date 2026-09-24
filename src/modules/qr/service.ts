import { and, count, desc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { JSDOM } from "jsdom";
import QRCodeStyling from "qr-code-styling";
import sharp from "sharp";
import { jsPDF } from "jspdf";
// The UMD/main entry point doesn't expose a named `svg2pdf` export under Node's ESM loader
// (cjs-module-lexer can't see through the minified UMD bundle) — import the ES build directly.
import { svg2pdf } from "svg2pdf.js/dist/svg2pdf.es.js";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/db/client";
import { links, shortLinks } from "@/modules/links";
import { qrCodes, qrDesignTemplates } from "./db";
import { LOGO_SAFE_ZONE_RATIO, resolveErrorCorrectionLevel, type ErrorCorrectionLevel } from "./logo";

export type QrCodeRow = typeof qrCodes.$inferSelect;
export type QrDesignTemplateRow = typeof qrDesignTemplates.$inferSelect;

export type QrCodeListFilter = {
  status?: "active" | "archived" | "disabled";
  mode?: "dynamic" | "static";
  folderId?: string;
  campaignId?: string;
  search?: string;
  page: number;
  pageSize: number;
};

export type QrShapeType = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
export type QrCornerType = QrShapeType | "dot";

export type QrCustomization = {
  backgroundColor?: string;
  foregroundColor?: string;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  logoUrl?: string;
  dotsType?: QrShapeType;
  cornersSquareType?: QrCornerType;
  cornersDotType?: QrCornerType;
};

// Organizational metadata shared by every creation path — never affects redirect resolution or
// the encoded QR content (name, placement photo), or is itself encoded (folder/campaign).
export type QrGrouping = {
  name: string;
  folderId?: string;
  campaignId?: string;
  placementImageUrl?: string;
};

export async function createDynamicQrCode(
  input: {
    organizationId: string;
    linkId: string;
    shortLinkId: string;
  } & QrCustomization &
    QrGrouping,
): Promise<QrCodeRow> {
  const [qr] = await db
    .insert(qrCodes)
    .values({ ...input, mode: "dynamic" })
    .returning();
  return qr;
}

export async function createStaticQrCode(
  input: {
    organizationId: string;
    payload: string;
    staticKind: "text" | "vcard" | "email" | "sms" | "wifi";
  } & QrCustomization &
    QrGrouping,
): Promise<QrCodeRow> {
  const { payload, staticKind, ...rest } = input;
  const [qr] = await db
    .insert(qrCodes)
    .values({
      ...rest,
      mode: "static",
      staticPayload: payload,
      staticKind,
    })
    .returning();
  return qr;
}

export async function getQrCode(id: string): Promise<QrCodeRow | undefined> {
  const rows = await db.select().from(qrCodes).where(eq(qrCodes.id, id)).limit(1);
  return rows[0];
}

// A link has at most one dynamic QR in practice — nothing in the UI creates a second short
// link/QR pair for an already-existing link — so the first match is the right one.
export async function getQrCodeByLinkId(linkId: string): Promise<QrCodeRow | undefined> {
  const rows = await db.select().from(qrCodes).where(eq(qrCodes.linkId, linkId)).limit(1);
  return rows[0];
}

function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export async function listQrCodes(
  organizationId: string,
  filter: QrCodeListFilter,
): Promise<{ rows: QrCodeRow[]; total: number; page: number }> {
  const pageSize = Math.max(1, filter.pageSize);
  const search = filter.search?.trim();
  const searchPattern = search ? `%${escapeLikePattern(search)}%` : undefined;
  const where = and(
    eq(qrCodes.organizationId, organizationId),
    filter.status ? eq(qrCodes.status, filter.status) : undefined,
    filter.mode ? eq(qrCodes.mode, filter.mode) : undefined,
    filter.folderId ? eq(qrCodes.folderId, filter.folderId) : undefined,
    filter.campaignId ? eq(qrCodes.campaignId, filter.campaignId) : undefined,
    searchPattern
      ? or(
          ilike(qrCodes.name, searchPattern),
          ilike(qrCodes.staticPayload, searchPattern),
          ilike(links.destinationUrl, searchPattern),
          ilike(shortLinks.slug, searchPattern),
        )
      : undefined,
  );

  const [totals] = await db
    .select({ total: count() })
    .from(qrCodes)
    .leftJoin(links, eq(qrCodes.linkId, links.id))
    .leftJoin(shortLinks, eq(qrCodes.shortLinkId, shortLinks.id))
    .where(where);

  const total = totals?.total ?? 0;
  const requestedPage = Math.max(1, filter.page);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, lastPage);

  const rows = await db
    .select({ qr: qrCodes })
    .from(qrCodes)
    .leftJoin(links, eq(qrCodes.linkId, links.id))
    .leftJoin(shortLinks, eq(qrCodes.shortLinkId, shortLinks.id))
    .where(where)
    .orderBy(desc(qrCodes.createdAt), desc(qrCodes.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { rows: rows.map((row) => row.qr), total, page };
}

export async function countActiveQrCodes(organizationId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(qrCodes)
    .where(and(eq(qrCodes.organizationId, organizationId), eq(qrCodes.status, "active")));

  return rows[0]?.count ?? 0;
}

export async function listQrGroupAvailability(organizationId: string): Promise<{
  folderIds: string[];
  campaignIds: string[];
}> {
  const [folders, campaigns] = await Promise.all([
    db
      .selectDistinct({ id: qrCodes.folderId })
      .from(qrCodes)
      .where(and(eq(qrCodes.organizationId, organizationId), isNotNull(qrCodes.folderId))),
    db
      .selectDistinct({ id: qrCodes.campaignId })
      .from(qrCodes)
      .where(and(eq(qrCodes.organizationId, organizationId), isNotNull(qrCodes.campaignId))),
  ]);

  return {
    folderIds: folders.flatMap((row) => (row.id ? [row.id] : [])),
    campaignIds: campaigns.flatMap((row) => (row.id ? [row.id] : [])),
  };
}

// No hard-delete anywhere (I-7). "archived" keeps a dynamic QR resolving — see
// docs/superpowers/specs/2026-09-09-phase6-campaigns-print-runs-design.md.
export async function archiveQrCode(id: string): Promise<QrCodeRow> {
  const [qr] = await db.update(qrCodes).set({ status: "archived" }).where(eq(qrCodes.id, id)).returning();
  return qr;
}

export async function updateQrCodeName(id: string, name: string): Promise<QrCodeRow> {
  const [qr] = await db.update(qrCodes).set({ name }).where(eq(qrCodes.id, id)).returning();
  return qr;
}

export async function createQrDesignTemplate(
  input: {
    organizationId: string;
    name: string;
  } & Required<
    Pick<QrCustomization, "dotsType" | "cornersSquareType" | "cornersDotType" | "backgroundColor" | "foregroundColor" | "errorCorrectionLevel">
  > &
    Pick<QrCustomization, "logoUrl">,
): Promise<QrDesignTemplateRow> {
  const [template] = await db.insert(qrDesignTemplates).values(input).returning();
  return template;
}

export async function listQrDesignTemplates(organizationId: string): Promise<QrDesignTemplateRow[]> {
  return db.select().from(qrDesignTemplates).where(eq(qrDesignTemplates.organizationId, organizationId));
}

const QR_PIXEL_SIZE = 512;

// The resolvable /q/:code payload for a dynamic QR reuses its short link's slug (Phase 3's
// redirect engine tells qr_scan vs link_click apart by route prefix, not by a separate code) —
// static QR just encodes its own fixed payload.
async function buildBaseSvg(encodedValue: string, options: QrCustomization): Promise<string> {
  const hasLogo = Boolean(options.logoUrl);
  const errorCorrectionLevel = resolveErrorCorrectionLevel(options.errorCorrectionLevel ?? "M", hasLogo);
  const color = options.foregroundColor ?? "#f7eeeb";

  // No `image`/`imageOptions` here on purpose: qr-code-styling's own image embedding hangs
  // indefinitely in Node's jsdom SVG mode (verified directly — getRawData never resolves when an
  // `image` option is set). The logo is composited afterward by embedLogo() instead, which also
  // means SVG exports can carry a logo (the old renderer couldn't).
  const qr = new QRCodeStyling({
    width: QR_PIXEL_SIZE,
    height: QR_PIXEL_SIZE,
    type: "svg",
    data: encodedValue,
    jsdom: JSDOM,
    qrOptions: { errorCorrectionLevel },
    dotsOptions: { type: options.dotsType ?? "square", color },
    cornersSquareOptions: { type: options.cornersSquareType ?? "square", color },
    cornersDotOptions: { type: options.cornersDotType ?? "square", color },
    backgroundOptions: { color: options.backgroundColor ?? "#1c130f" },
  } as ConstructorParameters<typeof QRCodeStyling>[0]);

  const buffer = await qr.getRawData("svg");
  if (!buffer) throw new Error("No se pudo generar el QR.");
  return (buffer as Buffer).toString("utf-8");
}

// Resolves a logoUrl to bytes + content-type: an absolute URL (a Supabase Storage public URL, the
// common case) is fetched; a path starting with "/" is one of this app's own bundled presets
// (public/qr-presets/*) and is read straight off disk — a server-side `fetch` can't resolve a
// relative URL (no origin), so it can't be treated the same as an uploaded logo's URL.
async function readLogoBytes(logoUrl: string): Promise<{ bytes: Buffer; contentType: string }> {
  if (logoUrl.startsWith("/")) {
    const filePath = path.join(process.cwd(), "public", logoUrl);
    const bytes = await readFile(filePath);
    const contentType = logoUrl.endsWith(".svg") ? "image/svg+xml" : "image/png";
    return { bytes, contentType };
  }

  const response = await fetch(logoUrl);
  if (!response.ok) {
    throw new Error(`No se pudo obtener el logo: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "image/png";
  return { bytes, contentType };
}

// Splices a centered <image> into the generated SVG — same visual placement/size the old sharp
// composite used (LOGO_SAFE_ZONE_RATIO), just as an SVG element instead of a raster composite.
async function embedLogo(svg: string, logoUrl: string): Promise<string> {
  const { bytes, contentType } = await readLogoBytes(logoUrl);
  const dataUri = `data:${contentType};base64,${bytes.toString("base64")}`;
  const logoSize = QR_PIXEL_SIZE * LOGO_SAFE_ZONE_RATIO;
  const offset = (QR_PIXEL_SIZE - logoSize) / 2;
  const imageTag = `<image x="${offset}" y="${offset}" width="${logoSize}" height="${logoSize}" href="${dataUri}" />`;
  return svg.replace("</svg>", `${imageTag}</svg>`);
}

export async function exportQrPng(encodedValue: string, options: QrCustomization): Promise<Buffer> {
  let svg = await buildBaseSvg(encodedValue, options);
  if (options.logoUrl) svg = await embedLogo(svg, options.logoUrl);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function exportQrSvg(encodedValue: string, options: QrCustomization): Promise<string> {
  let svg = await buildBaseSvg(encodedValue, options);
  if (options.logoUrl) svg = await embedLogo(svg, options.logoUrl);
  return svg;
}

// A vector PDF — since Illustrator's native .ai format has been PDF-based internally since AI 9
// (2000), a plain PDF opens in Illustrator as fully editable artwork regardless of the file
// extension it's saved under; the download route names it "qr-<id>.ai" for that reason.
//
// The logo is composited in a second step, not spliced into the SVG before conversion like the
// PNG/SVG exports do: svg2pdf resolving an <image> element itself hangs forever in this same
// jsdom-without-a-real-Image-loader environment (the exact issue noted on embedLogo/buildBaseSvg
// above, verified directly here too) — jsPDF's own addImage() is synchronous and sidesteps it.
export async function exportQrPdf(encodedValue: string, options: QrCustomization): Promise<Buffer> {
  const svg = await buildBaseSvg(encodedValue, options);
  const logo = options.logoUrl ? await readLogoBytes(options.logoUrl) : undefined;
  const logoIsSvg = logo?.contentType.includes("svg") ?? false;
  const logoMarkup = logo && logoIsSvg ? logo.bytes.toString("utf-8") : "";

  // svg2pdf reaches for these as ambient globals, not just via the element it's given — scoped to
  // this call and restored in `finally` so two concurrent PDF exports don't fight over them.
  const dom = new JSDOM(`<!DOCTYPE html><body>${svg}${logoMarkup}</body>`);
  const globals = {
    window: dom.window,
    document: dom.window.document,
    DOMParser: dom.window.DOMParser,
    XMLSerializer: dom.window.XMLSerializer,
    Element: dom.window.Element,
    SVGElement: dom.window.SVGElement,
    Node: dom.window.Node,
  };
  const previous: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(globals)) {
    previous[key] = (globalThis as Record<string, unknown>)[key];
    (globalThis as Record<string, unknown>)[key] = value;
  }

  try {
    const [qrSvgEl, logoSvgEl] = dom.window.document.querySelectorAll("svg");
    if (!qrSvgEl) throw new Error("No se pudo generar el QR.");

    const pdf = new jsPDF({ unit: "pt", format: [QR_PIXEL_SIZE, QR_PIXEL_SIZE] });
    await svg2pdf(qrSvgEl, pdf, { x: 0, y: 0, width: QR_PIXEL_SIZE, height: QR_PIXEL_SIZE });

    if (logo) {
      const logoSize = QR_PIXEL_SIZE * LOGO_SAFE_ZONE_RATIO;
      const offset = (QR_PIXEL_SIZE - logoSize) / 2;
      if (logoIsSvg && logoSvgEl) {
        await svg2pdf(logoSvgEl, pdf, { x: offset, y: offset, width: logoSize, height: logoSize });
      } else if (!logoIsSvg) {
        const format = logo.contentType.includes("jpeg") ? "JPEG" : "PNG";
        pdf.addImage(logo.bytes, format, offset, offset, logoSize, logoSize);
      }
    }

    return Buffer.from(pdf.output("arraybuffer"));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete (globalThis as Record<string, unknown>)[key];
      else (globalThis as Record<string, unknown>)[key] = value;
    }
  }
}
