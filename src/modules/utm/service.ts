import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { normalizeUtmValue } from "@/lib/utm";
import { utmPresets } from "./db";
import {
  validateSourceValue,
  validateMediumValue,
  validateCustomParameters,
  validatePairing,
  type CustomParameter,
  type SourceMode,
} from "./validation";

export type UtmPreset = typeof utmPresets.$inferSelect;

// The shape a Link create/edit flow needs to apply a template — never the raw preset row, so
// callers depend on the stable public contract rather than the table's evolving columns.
export type ApplyableUtmTemplate = {
  id: string;
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string | null;
  utmContent: string | null;
  utmId: string | null;
  customParameters: CustomParameter[];
};

export type TemplateStatus = "active" | "draft" | "archived";

export type CreateUtmPresetInput = {
  organizationId: string;
  name: string;
  description?: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm?: string | null;
  utmContent?: string | null;
  utmId?: string | null;
  customParameters?: CustomParameter[];
  status?: TemplateStatus;
  createdBy?: string | null;
  sourceMode?: SourceMode;
};

export type UpdateUtmPresetInput = {
  id: string;
  organizationId: string;
  name?: string;
  description?: string | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string | null;
  utmContent?: string | null;
  utmId?: string | null;
  customParameters?: CustomParameter[];
  status?: TemplateStatus;
  sourceMode?: SourceMode;
};

export type NormalizedTemplateValues = {
  name: string;
  description: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string | null;
  utmContent: string | null;
  utmId: string | null;
  customParameters: CustomParameter[];
  status: TemplateStatus;
  warnings: string[];
};

type NormalizeInput = {
  name: string;
  description?: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm?: string | null;
  utmContent?: string | null;
  utmId?: string | null;
  customParameters?: CustomParameter[];
  status?: TemplateStatus;
  sourceMode?: SourceMode;
};

function optionalNormalized(raw: string | null | undefined): string | null {
  return raw && raw.trim() ? normalizeUtmValue(raw) : null;
}

// Pure validation + normalization: new writes are canonical snake_case, historical values are
// never touched (they only pass through here when a template is edited, in which case they are
// re-normalized as part of the user's explicit edit).
export function normalizeTemplateValues(input: NormalizeInput): NormalizedTemplateValues {
  const sourceMode = input.sourceMode ?? "controlled";

  const sourceResult = validateSourceValue(input.utmSource, sourceMode);
  const mediumResult = validateMediumValue(input.utmMedium);
  const customResult = validateCustomParameters(input.customParameters ?? []);
  const pairingResult = validatePairing(input.utmSource, input.utmMedium);

  const errors = [...sourceResult.errors, ...mediumResult.errors, ...customResult.errors];
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  return {
    name: input.name.trim(),
    description: input.description?.trim() ? input.description.trim() : null,
    utmSource: normalizeUtmValue(input.utmSource),
    utmMedium: normalizeUtmValue(input.utmMedium),
    utmCampaign: normalizeUtmValue(input.utmCampaign),
    utmTerm: optionalNormalized(input.utmTerm),
    utmContent: optionalNormalized(input.utmContent),
    utmId: optionalNormalized(input.utmId),
    customParameters: (input.customParameters ?? []).map((pair) => ({
      key: pair.key.trim(),
      value: pair.value.trim(),
    })),
    status: input.status ?? "active",
    warnings: pairingResult.warnings,
  };
}

function toApplyableTemplate(preset: UtmPreset): ApplyableUtmTemplate {
  return {
    id: preset.id,
    name: preset.name,
    utmSource: preset.utmSource,
    utmMedium: preset.utmMedium,
    utmCampaign: preset.utmCampaign,
    utmTerm: preset.utmTerm,
    utmContent: preset.utmContent,
    utmId: preset.utmId,
    customParameters: preset.customParameters,
  };
}

export async function createUtmPreset(input: CreateUtmPresetInput): Promise<UtmPreset> {
  const values = normalizeTemplateValues(input);
  const [preset] = await db
    .insert(utmPresets)
    .values({
      organizationId: input.organizationId,
      name: values.name,
      description: values.description,
      utmSource: values.utmSource,
      utmMedium: values.utmMedium,
      utmCampaign: values.utmCampaign,
      utmTerm: values.utmTerm,
      utmContent: values.utmContent,
      utmId: values.utmId,
      customParameters: values.customParameters,
      status: values.status,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return preset;
}

export async function updateUtmPreset(input: UpdateUtmPresetInput): Promise<UtmPreset> {
  const existingRows = await db
    .select()
    .from(utmPresets)
    .where(and(eq(utmPresets.id, input.id), eq(utmPresets.organizationId, input.organizationId)))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) {
    throw new Error("Plantilla no encontrada.");
  }

  const values = normalizeTemplateValues({
    name: input.name ?? existing.name,
    description: input.description !== undefined ? input.description : existing.description,
    utmSource: input.utmSource ?? existing.utmSource,
    utmMedium: input.utmMedium ?? existing.utmMedium,
    utmCampaign: input.utmCampaign ?? existing.utmCampaign,
    utmTerm: input.utmTerm !== undefined ? input.utmTerm : existing.utmTerm,
    utmContent: input.utmContent !== undefined ? input.utmContent : existing.utmContent,
    utmId: input.utmId !== undefined ? input.utmId : existing.utmId,
    customParameters: input.customParameters ?? existing.customParameters,
    status: input.status ?? existing.status,
    sourceMode: input.sourceMode,
  });

  const [preset] = await db
    .update(utmPresets)
    .set({
      name: values.name,
      description: values.description,
      utmSource: values.utmSource,
      utmMedium: values.utmMedium,
      utmCampaign: values.utmCampaign,
      utmTerm: values.utmTerm,
      utmContent: values.utmContent,
      utmId: values.utmId,
      customParameters: values.customParameters,
      status: values.status,
      updatedAt: new Date(),
    })
    .where(and(eq(utmPresets.id, input.id), eq(utmPresets.organizationId, input.organizationId)))
    .returning();
  return preset;
}

// Returns every template for the organization (any status) — the settings manager displays draft,
// archived, and legacy rows so historical values remain readable and editable in place.
export async function listUtmPresets(organizationId: string): Promise<UtmPreset[]> {
  return db.select().from(utmPresets).where(eq(utmPresets.organizationId, organizationId));
}

// Active-only, org-scoped list for Link create/edit selectors (spec: draft/archived/cross-org are
// never offered).
export async function listActiveUtmTemplates(organizationId: string): Promise<ApplyableUtmTemplate[]> {
  const rows = await db
    .select()
    .from(utmPresets)
    .where(and(eq(utmPresets.organizationId, organizationId), eq(utmPresets.status, "active")));
  return rows.map(toApplyableTemplate);
}

// Server-authoritative re-fetch by template ID — prevents cross-org, stale, draft, or archived
// application (the Link flow trusts only this lookup, never client-sent parameters).
export async function getActiveUtmTemplate(
  id: string,
  organizationId: string,
): Promise<ApplyableUtmTemplate | undefined> {
  const rows = await db
    .select()
    .from(utmPresets)
    .where(
      and(
        eq(utmPresets.id, id),
        eq(utmPresets.organizationId, organizationId),
        eq(utmPresets.status, "active"),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? toApplyableTemplate(row) : undefined;
}

// Lifecycle transition (no hard delete, ARCHITECTURE.md I-7): archived templates stay readable but
// disappear from Link selectors.
export async function archiveUtmPreset(id: string, organizationId: string): Promise<UtmPreset> {
  const [preset] = await db
    .update(utmPresets)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(utmPresets.id, id), eq(utmPresets.organizationId, organizationId)))
    .returning();
  if (!preset) {
    throw new Error("Plantilla no encontrada.");
  }
  return preset;
}
