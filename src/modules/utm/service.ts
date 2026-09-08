import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { utmPresets } from "./db";
import { normalizeUtmValue } from "./normalize";

export type UtmPreset = typeof utmPresets.$inferSelect;

export type CreateUtmPresetInput = {
  organizationId: string;
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm?: string;
  utmContent?: string;
};

export async function createUtmPreset(input: CreateUtmPresetInput): Promise<UtmPreset> {
  const [preset] = await db
    .insert(utmPresets)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      utmSource: normalizeUtmValue(input.utmSource),
      utmMedium: normalizeUtmValue(input.utmMedium),
      utmCampaign: normalizeUtmValue(input.utmCampaign),
      utmTerm: input.utmTerm ? normalizeUtmValue(input.utmTerm) : undefined,
      utmContent: input.utmContent ? normalizeUtmValue(input.utmContent) : undefined,
    })
    .returning();
  return preset;
}

export async function listUtmPresets(organizationId: string): Promise<UtmPreset[]> {
  return db.select().from(utmPresets).where(eq(utmPresets.organizationId, organizationId));
}
