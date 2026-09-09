import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import sharp from "sharp";
import { db } from "@/db/client";
import { qrCodes } from "./db";
import { computeLogoDimensions, resolveErrorCorrectionLevel, type ErrorCorrectionLevel } from "./logo";

export type QrCodeRow = typeof qrCodes.$inferSelect;

export type QrCustomization = {
  backgroundColor?: string;
  foregroundColor?: string;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  logoUrl?: string;
};

export async function createDynamicQrCode(
  input: {
    organizationId: string;
    linkId: string;
    shortLinkId: string;
  } & QrCustomization,
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
  } & QrCustomization,
): Promise<QrCodeRow> {
  const { payload, ...rest } = input;
  const [qr] = await db
    .insert(qrCodes)
    .values({
      ...rest,
      mode: "static",
      staticPayload: payload,
    })
    .returning();
  return qr;
}

export async function getQrCode(id: string): Promise<QrCodeRow | undefined> {
  const rows = await db.select().from(qrCodes).where(eq(qrCodes.id, id)).limit(1);
  return rows[0];
}

export async function listQrCodes(organizationId: string): Promise<QrCodeRow[]> {
  return db.select().from(qrCodes).where(eq(qrCodes.organizationId, organizationId));
}

const QR_PIXEL_SIZE = 512;

// The resolvable /q/:code payload for a dynamic QR reuses its short link's slug (Phase 3's
// redirect engine tells qr_scan vs link_click apart by route prefix, not by a separate code) —
// static QR just encodes its own fixed payload.
export async function exportQrPng(encodedValue: string, options: QrCustomization): Promise<Buffer> {
  const hasLogo = Boolean(options.logoUrl);
  const errorCorrectionLevel = resolveErrorCorrectionLevel(
    options.errorCorrectionLevel ?? "M",
    hasLogo,
  );

  const qrBuffer = await QRCode.toBuffer(encodedValue, {
    errorCorrectionLevel,
    width: QR_PIXEL_SIZE,
    color: {
      dark: options.foregroundColor ?? "#f7eeeb",
      light: options.backgroundColor ?? "#1c130f",
    },
  });

  if (!options.logoUrl) {
    return qrBuffer;
  }

  const logoResponse = await fetch(options.logoUrl);
  if (!logoResponse.ok) {
    throw new Error(`Could not fetch logo: ${logoResponse.status}`);
  }
  const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
  const { width, height } = computeLogoDimensions(QR_PIXEL_SIZE);
  const resizedLogo = await sharp(logoBuffer).resize(width, height, { fit: "contain" }).toBuffer();

  return sharp(qrBuffer)
    .composite([{ input: resizedLogo, gravity: "center" }])
    .png()
    .toBuffer();
}

// No logo support — an SVG with a raster logo embedded loses portability. UI disables SVG
// download once a logo is attached (design decision, not enforced here).
export async function exportQrSvg(
  encodedValue: string,
  options: Omit<QrCustomization, "logoUrl">,
): Promise<string> {
  return QRCode.toString(encodedValue, {
    type: "svg",
    errorCorrectionLevel: options.errorCorrectionLevel ?? "M",
    color: {
      dark: options.foregroundColor ?? "#f7eeeb",
      light: options.backgroundColor ?? "#1c130f",
    },
  });
}
