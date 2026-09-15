"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import {
  createDynamicQrCode,
  createStaticQrCode,
  createQrDesignTemplate,
  archiveQrCode,
  updateQrCodeName,
  buildStaticPayload,
} from "@/modules/qr";
import { createLink, createShortLink, createFolder, listDomains, type Folder } from "@/modules/links";
import { createCampaign, type Campaign } from "@/modules/campaigns";
import { normalizeUtmValue, createUtmPreset } from "@/modules/utm";
import { recordAudit, checkRateLimit } from "@/modules/audit";
import {
  BULK_QR_MAX_ROWS,
  normalizeBulkQrRow,
  validateBulkQrRow,
  type BulkQrImportRow,
} from "./bulk/bulk-csv";

const RATE_LIMIT_ERROR = "Demasiadas acciones. Inténtalo de nuevo en breve.";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color hexadecimal como #1c130f.");
const ecLevel = z.enum(["L", "M", "Q", "H"]);
const shapeType = z.enum(["square", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"]);
const cornerType = z.enum(["square", "dot", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"]);

const customizationSchema = z.object({
  backgroundColor: hexColor,
  foregroundColor: hexColor,
  errorCorrectionLevel: ecLevel,
  // Not .url() — a preset logo is a relative app-bundled path (/qr-presets/globe.svg), not an
  // absolute URL like an uploaded logo's Supabase Storage link.
  logoUrl: z.string().optional().or(z.literal("")),
  dotsType: shapeType,
  cornersSquareType: cornerType,
  cornersDotType: cornerType,
});

// Optional — present only when the "Guardar como plantilla" checkbox was checked.
const templateSchema = z.object({
  saveAsTemplate: z.enum(["true"]).optional().or(z.literal("")),
  templateName: z.string().trim().max(255).optional().or(z.literal("")),
});

// Shared by every creation path — name (required), optional folder-or-campaign grouping, optional
// placement photo. See docs/superpowers/specs/2026-09-10-qr-creation-wizard-design.md.
const groupingSchema = z.object({
  name: z.string().trim().min(1).max(255),
  folderId: z.string().uuid().optional().or(z.literal("")),
  campaignId: z.string().uuid().optional().or(z.literal("")),
  placementImageUrl: z.string().url().optional().or(z.literal("")),
});

// Optional — present only when the "Guardar como preajuste UTM" checkbox was checked. Mirrors
// templateSchema's shape/posture for the same reason: a create-alongside-the-QR save, not its own
// submit flow.
const utmPresetSaveSchema = z.object({
  saveUtmAsPreset: z.enum(["true"]).optional().or(z.literal("")),
  utmPresetName: z.string().trim().max(255).optional().or(z.literal("")),
});

const createWebsiteQrSchema = z
  .object({
    destinationUrl: z.string().trim().min(1).max(2048),
    utmSource: z.string().trim().max(255).optional(),
    utmMedium: z.string().trim().max(255).optional(),
    utmCampaign: z.string().trim().max(255).optional(),
  })
  .merge(customizationSchema)
  .merge(groupingSchema)
  .merge(templateSchema)
  .merge(utmPresetSaveSchema);

export type CreateWebsiteQrFormState = { error?: string; qrCodeId?: string };

// One-step "Sitio web" flow (2026-09-09 design): creates the link, short link (auto-slug, on the
// organization's first domain), and QR code together — no separate "create a short link first"
// step. Sequential inserts, no db.transaction() wrapping them (the rest of the codebase doesn't
// use transactions either); a failure between steps can leave an orphaned link/short-link with no
// QR, an accepted low-probability simplification consistent with existing conventions.
export async function createWebsiteQrCodeAction(
  _prevState: CreateWebsiteQrFormState,
  formData: FormData,
): Promise<CreateWebsiteQrFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const parsed = createWebsiteQrSchema.safeParse({
    destinationUrl: formData.get("destinationUrl"),
    utmSource: formData.get("utmSource") || undefined,
    utmMedium: formData.get("utmMedium") || undefined,
    utmCampaign: formData.get("utmCampaign") || undefined,
    backgroundColor: formData.get("backgroundColor"),
    foregroundColor: formData.get("foregroundColor"),
    errorCorrectionLevel: formData.get("errorCorrectionLevel"),
    logoUrl: formData.get("logoUrl") || undefined,
    dotsType: formData.get("dotsType"),
    cornersSquareType: formData.get("cornersSquareType"),
    cornersDotType: formData.get("cornersDotType"),
    name: formData.get("name"),
    folderId: formData.get("folderId") || undefined,
    campaignId: formData.get("campaignId") || undefined,
    placementImageUrl: formData.get("placementImageUrl") || undefined,
    saveAsTemplate: formData.get("saveAsTemplate") || undefined,
    templateName: formData.get("templateName") || undefined,
    saveUtmAsPreset: formData.get("saveUtmAsPreset") || undefined,
    utmPresetName: formData.get("utmPresetName") || undefined,
  });
  if (!parsed.success) {
    return { error: "Ingresa un nombre, una URL de destino y colores válidos." };
  }

  const domains = await listDomains(user.profile.organizationId);
  const domain = domains[0];
  if (!domain) {
    return { error: "Primero agrega un dominio en la página de Enlaces." };
  }

  let qrCode;
  try {
    const link = await createLink({
      organizationId: user.profile.organizationId,
      destinationUrl: parsed.data.destinationUrl,
      utmSource: parsed.data.utmSource ? normalizeUtmValue(parsed.data.utmSource) : undefined,
      utmMedium: parsed.data.utmMedium ? normalizeUtmValue(parsed.data.utmMedium) : undefined,
      utmCampaign: parsed.data.utmCampaign ? normalizeUtmValue(parsed.data.utmCampaign) : undefined,
    });
    const shortLink = await createShortLink({
      organizationId: user.profile.organizationId,
      linkId: link.id,
      domainId: domain.id,
    });
    qrCode = await createDynamicQrCode({
      organizationId: user.profile.organizationId,
      linkId: link.id,
      shortLinkId: shortLink.id,
      backgroundColor: parsed.data.backgroundColor,
      foregroundColor: parsed.data.foregroundColor,
      errorCorrectionLevel: parsed.data.errorCorrectionLevel,
      logoUrl: parsed.data.logoUrl || undefined,
      dotsType: parsed.data.dotsType,
      cornersSquareType: parsed.data.cornersSquareType,
      cornersDotType: parsed.data.cornersDotType,
      name: parsed.data.name,
      folderId: parsed.data.folderId || undefined,
      campaignId: parsed.data.campaignId || undefined,
      placementImageUrl: parsed.data.placementImageUrl || undefined,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el código QR." };
  }

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "qr_code",
    resourceId: qrCode.id,
    after: qrCode,
  });

  // Non-transactional, same posture as the rest of this action: a failure here doesn't unwind the
  // already-created QR — it surfaces as a generic error only if it happens.
  if (parsed.data.saveAsTemplate === "true" && parsed.data.templateName) {
    await createQrDesignTemplate({
      organizationId: user.profile.organizationId,
      name: parsed.data.templateName,
      dotsType: parsed.data.dotsType,
      cornersSquareType: parsed.data.cornersSquareType,
      cornersDotType: parsed.data.cornersDotType,
      backgroundColor: parsed.data.backgroundColor,
      foregroundColor: parsed.data.foregroundColor,
      errorCorrectionLevel: parsed.data.errorCorrectionLevel,
      logoUrl: parsed.data.logoUrl || undefined,
    });
  }

  if (
    parsed.data.saveUtmAsPreset === "true" &&
    parsed.data.utmPresetName &&
    parsed.data.utmSource &&
    parsed.data.utmMedium &&
    parsed.data.utmCampaign
  ) {
    await createUtmPreset({
      organizationId: user.profile.organizationId,
      name: parsed.data.utmPresetName,
      utmSource: parsed.data.utmSource,
      utmMedium: parsed.data.utmMedium,
      utmCampaign: parsed.data.utmCampaign,
    });
    revalidatePath("/links");
  }

  revalidatePath("/qr");
  return { qrCodeId: qrCode.id };
}

// One discriminated schema for every non-website content type — they all end up as a
// static_payload string (built by buildStaticPayload), so one action covers all five instead of
// near-duplicating it five times. `kind` is the discriminant.
const staticKindFieldsSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), content: z.string().trim().min(1).max(2048) }),
  z.object({
    kind: z.literal("vcard"),
    fullName: z.string().trim().min(1).max(255),
    phone: z.string().trim().min(1).max(50),
    email: z.string().trim().email(),
    company: z.string().trim().max(255).optional(),
    website: z.string().trim().url().max(2048).optional(),
  }),
  z.object({
    kind: z.literal("email"),
    address: z.string().trim().email(),
    subject: z.string().trim().max(255).optional(),
    body: z.string().trim().max(2000).optional(),
  }),
  z.object({
    kind: z.literal("sms"),
    number: z.string().trim().min(1).max(30),
    message: z.string().trim().max(500).optional(),
  }),
  z.object({
    kind: z.literal("wifi"),
    ssid: z.string().trim().min(1).max(64),
    password: z.string().trim().max(128),
    security: z.enum(["WPA", "WEP", "nopass"]),
    hidden: z.coerce.boolean().default(false),
  }),
]);

const createStaticSchema = z.intersection(
  staticKindFieldsSchema,
  customizationSchema.merge(groupingSchema).merge(templateSchema),
);

export type CreateStaticQrFormState = { error?: string; qrCodeId?: string };

const STATIC_FIELD_KEYS = [
  "kind",
  "content",
  "fullName",
  "phone",
  "email",
  "company",
  "website",
  "address",
  "subject",
  "body",
  "number",
  "message",
  "ssid",
  "password",
  "security",
  "hidden",
  "backgroundColor",
  "foregroundColor",
  "errorCorrectionLevel",
  "logoUrl",
  "dotsType",
  "cornersSquareType",
  "cornersDotType",
  "name",
  "folderId",
  "campaignId",
  "placementImageUrl",
  "saveAsTemplate",
  "templateName",
] as const;

export async function createStaticQrCodeAction(
  _prevState: CreateStaticQrFormState,
  formData: FormData,
): Promise<CreateStaticQrFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  // formData.get() returns null for an absent field; the schema's .optional() fields need
  // undefined, not null, to validate as "not provided" — so only keys with an actual value here.
  const raw: Record<string, unknown> = {};
  for (const key of STATIC_FIELD_KEYS) {
    const value = formData.get(key);
    if (value !== null) raw[key] = value;
  }

  const parsed = createStaticSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Revisa los campos del formulario." };
  }

  const {
    name,
    folderId,
    campaignId,
    placementImageUrl,
    backgroundColor,
    foregroundColor,
    errorCorrectionLevel,
    logoUrl,
    dotsType,
    cornersSquareType,
    cornersDotType,
    saveAsTemplate,
    templateName,
    ...kindFields
  } = parsed.data;
  const payload = buildStaticPayload(kindFields);

  const qrCode = await createStaticQrCode({
    organizationId: user.profile.organizationId,
    payload,
    staticKind: kindFields.kind,
    name,
    folderId: folderId || undefined,
    campaignId: campaignId || undefined,
    placementImageUrl: placementImageUrl || undefined,
    backgroundColor,
    foregroundColor,
    errorCorrectionLevel,
    logoUrl: logoUrl || undefined,
    dotsType,
    cornersSquareType,
    cornersDotType,
  });

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "qr_code",
    resourceId: qrCode.id,
    after: qrCode,
  });

  if (saveAsTemplate === "true" && templateName) {
    await createQrDesignTemplate({
      organizationId: user.profile.organizationId,
      name: templateName,
      dotsType,
      cornersSquareType,
      cornersDotType,
      backgroundColor,
      foregroundColor,
      errorCorrectionLevel,
      logoUrl: logoUrl || undefined,
    });
  }

  revalidatePath("/qr");
  return { qrCodeId: qrCode.id };
}

// Inline "create from the grouping dropdown" actions — the QR wizard's "Agrupar en" select is
// the only place in the app a folder or campaign can be created today, so it needs to create one
// on the spot rather than sending the user away to a separate page. Called directly (not via
// useActionState) since GroupSelect needs the created row's id/name back immediately to select it.
export async function createFolderQuickAction(name: string): Promise<Folder | { error: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return { error: RATE_LIMIT_ERROR };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Ingresa un nombre para la carpeta." };

  const folder = await createFolder(user.profile.organizationId, trimmed);
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "folder",
    resourceId: folder.id,
    after: folder,
  });
  revalidatePath("/qr");
  return folder;
}

export async function createCampaignQuickAction(name: string): Promise<Campaign | { error: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return { error: RATE_LIMIT_ERROR };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Ingresa un nombre para la campaña." };

  const campaign = await createCampaign(user.profile.organizationId, trimmed);
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "campaign",
    resourceId: campaign.id,
    after: campaign,
  });
  revalidatePath("/qr");
  return campaign;
}

export async function archiveQrCodeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const id = z.string().uuid().parse(formData.get("id"));
  await archiveQrCode(id);
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "archive",
    resourceType: "qr_code",
    resourceId: id,
  });
  revalidatePath("/qr");
}

export type UpdateQrNameFormState = { error?: string };

export async function updateQrNameAction(
  _prevState: UpdateQrNameFormState,
  formData: FormData,
): Promise<UpdateQrNameFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const id = z.string().uuid().parse(formData.get("qrId"));
  const name = z.string().trim().min(1).max(255).parse(formData.get("name"));

  await updateQrCodeName(id, name);
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "qr_code",
    resourceId: id,
    after: { name },
  });

  revalidatePath("/qr");
  return {};
}

const bulkQrRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  url: z.string(),
  title: z.string(),
});
const bulkQrRowsSchema = z.array(bulkQrRowSchema).max(BULK_QR_MAX_ROWS);

export type BulkQrImportResult =
  | { rowNumber: number; title: string; status: "created"; qrCodeId: string }
  | { rowNumber: number; title: string; status: "failed"; error: string };

export type BulkQrImportSummary = {
  requested: number;
  created: number;
  failed: number;
  results: BulkQrImportResult[];
  error?: string;
};

function emptyBulkQrImportSummary(error: string): BulkQrImportSummary {
  return { requested: 0, created: 0, failed: 0, results: [], error };
}

export async function createBulkWebsiteQrCodesAction(
  submittedRows: BulkQrImportRow[],
): Promise<BulkQrImportSummary> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return emptyBulkQrImportSummary(RATE_LIMIT_ERROR);

  const parsed = bulkQrRowsSchema.safeParse(submittedRows);
  if (!parsed.success) {
    return emptyBulkQrImportSummary("No hay filas válidas para crear.");
  }

  const orderedResults: Array<BulkQrImportResult | undefined> = [];
  const validRows: Array<{ row: BulkQrImportRow; resultIndex: number }> = [];
  const rowNumbers = new Set<number>();

  for (const [resultIndex, submittedRow] of parsed.data.entries()) {
    const row = normalizeBulkQrRow(submittedRow);
    if (rowNumbers.has(row.rowNumber)) {
      orderedResults[resultIndex] = {
        rowNumber: row.rowNumber,
        title: row.title,
        status: "failed",
        error: `La fila ${row.rowNumber} está duplicada.`,
      };
      continue;
    }
    rowNumbers.add(row.rowNumber);

    const error = validateBulkQrRow(row);
    if (error) {
      orderedResults[resultIndex] = { rowNumber: row.rowNumber, title: row.title, status: "failed", error };
      continue;
    }
    validRows.push({ row, resultIndex });
  }

  const results = orderedResults.filter(
    (result): result is BulkQrImportResult => result !== undefined,
  );

  if (validRows.length === 0) {
    return {
      requested: parsed.data.length,
      created: 0,
      failed: results.length,
      results,
      error: results.length === 0 ? "No hay filas válidas para crear." : undefined,
    };
  }

  const domains = await listDomains(user.profile.organizationId);
  const domain = domains[0];
  if (!domain) {
    return emptyBulkQrImportSummary("Primero agrega un dominio en la página de Enlaces.");
  }

  let created = 0;
  for (const { row, resultIndex } of validRows) {
    try {
      const link = await createLink({
        organizationId: user.profile.organizationId,
        destinationUrl: row.url,
      });
      const shortLink = await createShortLink({
        organizationId: user.profile.organizationId,
        linkId: link.id,
        domainId: domain.id,
      });
      const qrCode = await createDynamicQrCode({
        organizationId: user.profile.organizationId,
        linkId: link.id,
        shortLinkId: shortLink.id,
        name: row.title,
        backgroundColor: "#1c1213",
        foregroundColor: "#f7edee",
        errorCorrectionLevel: "M",
        dotsType: "square",
        cornersSquareType: "square",
        cornersDotType: "square",
      });
      await recordAudit({
        organizationId: user.profile.organizationId,
        userId: user.id,
        action: "create",
        resourceType: "qr_code",
        resourceId: qrCode.id,
        after: qrCode,
      });
      created += 1;
      orderedResults[resultIndex] = {
        rowNumber: row.rowNumber,
        title: row.title,
        status: "created",
        qrCodeId: qrCode.id,
      };
    } catch (error) {
      orderedResults[resultIndex] = {
        rowNumber: row.rowNumber,
        title: row.title,
        status: "failed",
        error: error instanceof Error ? error.message : "No se pudo crear el código QR.",
      };
    }
  }

  if (created > 0) revalidatePath("/qr");

  const finalResults = orderedResults.filter(
    (result): result is BulkQrImportResult => result !== undefined,
  );

  return {
    requested: parsed.data.length,
    created,
    failed: finalResults.length - created,
    results: finalResults,
  };
}
