import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { normalizeUtmValue } from "@/lib/utm";
import { utmPresets } from "./db";

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

export async function deleteUtmPreset(id: string, organizationId: string): Promise<void> {
  const rows = await db.select().from(utmPresets).where(eq(utmPresets.id, id)).limit(1);
  const preset = rows[0];
  if (!preset || preset.organizationId !== organizationId) {
    throw new Error("Plantilla no encontrada.");
  }
  await db.delete(utmPresets).where(eq(utmPresets.id, id));
}
