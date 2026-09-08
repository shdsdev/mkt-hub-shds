import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db/client";
import { qrCodes } from "./db";

export type QrCodeRow = typeof qrCodes.$inferSelect;

export async function createDynamicQrCode(input: {
  organizationId: string;
  linkId: string;
  shortLinkId: string;
}): Promise<QrCodeRow> {
  const [qr] = await db
    .insert(qrCodes)
    .values({ ...input, mode: "dynamic" })
    .returning();
  return qr;
}

export async function createStaticQrCode(input: {
  organizationId: string;
  payload: string;
}): Promise<QrCodeRow> {
  const [qr] = await db
    .insert(qrCodes)
    .values({
      organizationId: input.organizationId,
      mode: "static",
      staticPayload: input.payload,
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

// The resolvable /q/:code payload for a dynamic QR reuses its short link's slug (Phase 3's
// redirect engine tells qr_scan vs link_click apart by route prefix, not by a separate code) —
// static QR just encodes its own fixed payload.
export async function exportQrPng(encodedValue: string): Promise<string> {
  return QRCode.toDataURL(encodedValue, { errorCorrectionLevel: "M" });
}

export async function exportQrSvg(encodedValue: string): Promise<string> {
  return QRCode.toString(encodedValue, { type: "svg", errorCorrectionLevel: "M" });
}
