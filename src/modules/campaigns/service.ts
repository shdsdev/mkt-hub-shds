import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns, campaignLinks } from "./db";

export type Campaign = typeof campaigns.$inferSelect;

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
