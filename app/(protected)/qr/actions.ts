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
  getQrCode,
  updateQrCodeName,
  buildStaticPayload,
} from "@/modules/qr";
import {
  createLink,
  createShortLink,
  createFolder,
  getLink,
  listDomains,
  listFolders,
  updateLinkUtmValues,
  type Domain,
  type Folder,
} from "@/modules/links";
import { createCampaign, listCampaigns, type Campaign } from "@/modules/campaigns";
import { normalizeUtmValue } from "@/lib/utm";
import { createUtmPreset } from "@/modules/utm";
import { recordAudit, checkRateLimit } from "@/modules/audit";
import type { QrCustomization } from "@/modules/qr";
import {
  BULK_QR_MAX_ROWS,
  normalizeBulkQrRow,
  destinationContainsReservedUtm,
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

const updateDynamicQrUtmSchema = z.object({
  qrId: z.string().uuid(),
  utmSource: z.string().trim().max(255).optional(),
  utmMedium: z.string().trim().max(255).optional(),
  utmCampaign: z.string().trim().max(255).optional(),
  utmTerm: z.string().trim().max(255).optional(),
  utmContent: z.string().trim().max(255).optional(),
});

export type UpdateDynamicQrUtmFormState = { error?: string; success?: string };

export async function updateDynamicQrUtmAction(
  _state: UpdateDynamicQrUtmFormState,
  formData: FormData,
): Promise<UpdateDynamicQrUtmFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return { error: RATE_LIMIT_ERROR };

  const parsed = updateDynamicQrUtmSchema.safeParse({
    qrId: formData.get("qrId"),
    utmSource: formData.get("utmSource") || undefined,
    utmMedium: formData.get("utmMedium") || undefined,
    utmCampaign: formData.get("utmCampaign") || undefined,
    utmTerm: formData.get("utmTerm") || undefined,
    utmContent: formData.get("utmContent") || undefined,
  });
  if (!parsed.success) return { error: "Ingresa etiquetas UTM válidas." };

  const qr = await getQrCode(parsed.data.qrId);
  if (!qr || qr.mode !== "dynamic" || !qr.linkId || qr.organizationId !== user.profile.organizationId) {
    return { error: "El código QR no está disponible." };
  }

  const before = await getLink(qr.linkId);
  if (
    !before ||
    before.organizationId !== user.profile.organizationId ||
    destinationContainsReservedUtm(before.destinationUrl)
  ) {
    return { error: "La URL de destino no permite etiquetas UTM editables." };
  }

  const normalizedValues = {
    utmSource: parsed.data.utmSource ? normalizeUtmValue(parsed.data.utmSource) : undefined,
    utmMedium: parsed.data.utmMedium ? normalizeUtmValue(parsed.data.utmMedium) : undefined,
    utmCampaign: parsed.data.utmCampaign ? normalizeUtmValue(parsed.data.utmCampaign) : undefined,
    utmTerm: parsed.data.utmTerm ? normalizeUtmValue(parsed.data.utmTerm) : undefined,
    utmContent: parsed.data.utmContent ? normalizeUtmValue(parsed.data.utmContent) : undefined,
  };
  const after = await updateLinkUtmValues({
    organizationId: user.profile.organizationId,
    linkId: qr.linkId,
    values: normalizedValues,
  });
  if (!after) return { error: "La URL de destino no permite etiquetas UTM editables." };

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "destination_change",
    resourceType: "link",
    resourceId: qr.linkId,
    before: {
      utmSource: before.utmSource,
      utmMedium: before.utmMedium,
      utmCampaign: before.utmCampaign,
      utmTerm: before.utmTerm,
      utmContent: before.utmContent,
    },
    after: {
      utmSource: after.utmSource,
      utmMedium: after.utmMedium,
      utmCampaign: after.utmCampaign,
      utmTerm: after.utmTerm,
      utmContent: after.utmContent,
    },
  });
  revalidatePath("/qr");
  revalidatePath(`/links/${qr.linkId}`);
  return { success: "Etiquetas UTM actualizadas." };
}

const bulkQrRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  url: z.string(),
  title: z.string(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
});

export type BulkQrDesign = Required<
  Pick<
    QrCustomization,
    "backgroundColor" | "foregroundColor" | "errorCorrectionLevel" | "dotsType" | "cornersSquareType" | "cornersDotType"
  >
> &
  Pick<QrCustomization, "logoUrl">;

export type CreateBulkWebsiteQrCodesActionInput = {
  rows: BulkQrImportRow[];
  folderId?: string;
  campaignId?: string;
  design: BulkQrDesign;
  saveAsTemplate: boolean;
  templateName?: string;
};

const bulkInputSchema = z.object({
  rows: z.array(bulkQrRowSchema).min(1).max(BULK_QR_MAX_ROWS),
  folderId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  design: customizationSchema,
  saveAsTemplate: z.boolean(),
  templateName: z.string().optional(),
});

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

type BulkPreflight = {
  domain: Domain;
  group: { folderId?: string; campaignId?: string };
  rows: BulkQrImportRow[];
  design: BulkQrDesign;
  templateName?: string;
};

function preflightRowErrors(rows: BulkQrImportRow[]): Array<BulkQrImportResult | undefined> {
  const rowNumbers = new Set<number>();

  return rows.map((submittedRow) => {
    let row: BulkQrImportRow;
    try {
      row = normalizeBulkQrRow(submittedRow);
    } catch {
      return {
        rowNumber: submittedRow.rowNumber,
        title: submittedRow.title.trim(),
        status: "failed",
        error: `La fila ${submittedRow.rowNumber} tiene un valor UTM inválido.`,
      };
    }

    if (rowNumbers.has(row.rowNumber)) {
      return {
        rowNumber: row.rowNumber,
        title: row.title,
        status: "failed",
        error: `La fila ${row.rowNumber} está duplicada.`,
      };
    }
    rowNumbers.add(row.rowNumber);

    const error = validateBulkQrRow(row);
    if (error) return { rowNumber: row.rowNumber, title: row.title, status: "failed", error };
    return undefined;
  });
}

async function preflightBulkWebsiteQrCodes(
  organizationId: string,
  input: z.infer<typeof bulkInputSchema>,
): Promise<BulkPreflight | { error: BulkQrImportSummary }> {
  const rowErrors = preflightRowErrors(input.rows);
  if (rowErrors.some((rowError) => rowError !== undefined)) {
    return {
      error: {
        requested: input.rows.length,
        created: 0,
        failed: input.rows.length,
        results: input.rows.map((row, index) => rowErrors[index] ?? {
          rowNumber: row.rowNumber,
          title: row.title.trim(),
          status: "failed" as const,
          error: "La fila no pudo validarse.",
        }),
        error: "Revisa las filas del lote antes de crear los códigos QR.",
      },
    };
  }

  if (Boolean(input.folderId) === Boolean(input.campaignId)) {
    return { error: emptyBulkQrImportSummary("Selecciona exactamente una carpeta o campaña para el lote.") };
  }

  const templateName = input.templateName?.trim();
  if (input.saveAsTemplate && (!templateName || templateName.length > 255)) {
    return { error: emptyBulkQrImportSummary("Ingresa un nombre de plantilla válido.") };
  }

  const [domains, folders, campaigns] = await Promise.all([
    listDomains(organizationId),
    listFolders(organizationId),
    listCampaigns(organizationId),
  ]);
  const domain = domains[0];
  if (!domain) {
    return { error: emptyBulkQrImportSummary("Primero agrega un dominio en la página de Enlaces.") };
  }

  if (input.folderId && !folders.some((folder) => folder.id === input.folderId)) {
    return { error: emptyBulkQrImportSummary("La carpeta seleccionada no pertenece a tu organización.") };
  }
  if (input.campaignId && !campaigns.some((campaign) => campaign.id === input.campaignId)) {
    return { error: emptyBulkQrImportSummary("La campaña seleccionada no pertenece a tu organización.") };
  }

  return {
    domain,
    group: input.folderId ? { folderId: input.folderId } : { campaignId: input.campaignId },
    rows: input.rows.map(normalizeBulkQrRow),
    design: {
      ...input.design,
      logoUrl: input.design.logoUrl || undefined,
    },
    templateName: input.saveAsTemplate ? templateName : undefined,
  };
}

export async function createBulkWebsiteQrCodesAction(
  input: CreateBulkWebsiteQrCodesActionInput,
): Promise<BulkQrImportSummary> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return emptyBulkQrImportSummary(RATE_LIMIT_ERROR);

  const parsed = bulkInputSchema.safeParse(input);
  if (!parsed.success) {
    return emptyBulkQrImportSummary("No hay filas válidas para crear.");
  }

  const preflight = await preflightBulkWebsiteQrCodes(user.profile.organizationId, parsed.data);
  if ("error" in preflight) return preflight.error;

  if (preflight.templateName) {
    try {
      await createQrDesignTemplate({
        organizationId: user.profile.organizationId,
        name: preflight.templateName,
        ...preflight.design,
      });
    } catch (error) {
      return emptyBulkQrImportSummary(error instanceof Error ? error.message : "No se pudo guardar la plantilla.");
    }
  }

  let created = 0;
  const results: BulkQrImportResult[] = [];
  for (const row of preflight.rows) {
    try {
      const link = await createLink({
        organizationId: user.profile.organizationId,
        destinationUrl: row.url,
        utmSource: row.utmSource,
        utmMedium: row.utmMedium,
        utmCampaign: row.utmCampaign,
        utmTerm: row.utmTerm,
        utmContent: row.utmContent,
      });
      const shortLink = await createShortLink({
        organizationId: user.profile.organizationId,
        linkId: link.id,
        domainId: preflight.domain.id,
      });
      const qrCode = await createDynamicQrCode({
        organizationId: user.profile.organizationId,
        linkId: link.id,
        shortLinkId: shortLink.id,
        name: row.title,
        ...preflight.group,
        ...preflight.design,
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
      results.push({
        rowNumber: row.rowNumber,
        title: row.title,
        status: "created",
        qrCodeId: qrCode.id,
      });
    } catch (error) {
      results.push({
        rowNumber: row.rowNumber,
        title: row.title,
        status: "failed",
        error: error instanceof Error ? error.message : "No se pudo crear el código QR.",
      });
    }
  }

  if (created > 0) revalidatePath("/qr");

  return {
    requested: preflight.rows.length,
    created,
    failed: results.length - created,
    results,
  };
}
