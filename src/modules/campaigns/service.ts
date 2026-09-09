import { eq, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { countEventsForShortLink, countEventsForQrCode } from "@/modules/analytics";
import { campaigns, campaignLinks, printRuns } from "./db";

export type Campaign = typeof campaigns.$inferSelect;
export type PrintRun = typeof printRuns.$inferSelect;

export async function createCampaign(organizationId: string, name: string): Promise<Campaign> {
  const [campaign] = await db.insert(campaigns).values({ organizationId, name }).returning();
  return campaign;
}

export async function listCampaigns(organizationId: string): Promise<Campaign[]> {
  return db.select().from(campaigns).where(eq(campaigns.organizationId, organizationId));
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return rows[0];
}

// Ending a campaign never disables its links (SPEC.md §14) — this only flips the status field.
export async function endCampaign(id: string): Promise<Campaign> {
  const [campaign] = await db
    .update(campaigns)
    .set({ status: "ended" })
    .where(eq(campaigns.id, id))
    .returning();
  return campaign;
}

export async function addLinkToCampaign(campaignId: string, linkId: string): Promise<void> {
  await db.insert(campaignLinks).values({ campaignId, linkId }).onConflictDoNothing();
}

export async function listLinkIdsForCampaign(campaignId: string): Promise<string[]> {
  const rows = await db
    .select({ linkId: campaignLinks.linkId })
    .from(campaignLinks)
    .where(eq(campaignLinks.campaignId, campaignId));
  return rows.map((row) => row.linkId);
}

export type RecordPrintRunInput = {
  organizationId: string;
  quantity: number;
  qrCodeId?: string;
  shortLinkId?: string;
};

// Historical record — never edited or deleted once recorded (design decision, matches I-7's
// spirit: print run counts aren't meant to be mutable after the fact).
export async function recordPrintRun(input: RecordPrintRunInput): Promise<PrintRun> {
  if (Boolean(input.qrCodeId) === Boolean(input.shortLinkId)) {
    throw new Error("A print run must reference exactly one of qrCodeId or shortLinkId.");
  }
  if (input.quantity < 1) {
    throw new Error("Quantity must be at least 1.");
  }
  const [printRun] = await db.insert(printRuns).values(input).returning();
  return printRun;
}

// null = "no print run recorded" (DATABASE.md — never show a misleading 0% or 100%).
export async function getScanRateForShortLink(shortLinkId: string): Promise<number | null> {
  const [row] = await db
    .select({ total: sum(printRuns.quantity) })
    .from(printRuns)
    .where(eq(printRuns.shortLinkId, shortLinkId));
  const totalPrinted = row?.total ? Number(row.total) : 0;
  if (totalPrinted === 0) return null;

  const scans = await countEventsForShortLink(shortLinkId);
  return scans / totalPrinted;
}

export async function getScanRateForQrCode(qrCodeId: string): Promise<number | null> {
  const [row] = await db
    .select({ total: sum(printRuns.quantity) })
    .from(printRuns)
    .where(eq(printRuns.qrCodeId, qrCodeId));
  const totalPrinted = row?.total ? Number(row.total) : 0;
  if (totalPrinted === 0) return null;

  const scans = await countEventsForQrCode(qrCodeId);
  return scans / totalPrinted;
}
