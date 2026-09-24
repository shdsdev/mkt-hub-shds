"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { updateTheme, isValidThemeId, updateDefaultLogo } from "@/modules/users";
import {
  createDomain,
  updateDomain,
  deleteDomain,
  getDomain,
  reassignShortLinksToDomain,
} from "@/modules/links";
import {
  createUtmPreset,
  updateUtmPreset,
  archiveUtmPreset,
  deleteUtmPreset,
  type CustomParameter,
  type SourceMode,
  type TemplateStatus,
} from "@/modules/utm";
import { checkRateLimit } from "@/modules/audit";

export async function updateUserThemeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const themeId = z.string().min(1).parse(formData.get("themeId"));
  if (!isValidThemeId(themeId)) return;

  await updateTheme(user.id, themeId);
  revalidatePath("/", "layout");
}

// Org-wide (not per-user) — pre-fills into every new QR code's logo step (create-qr-modal.tsx).
export async function updateDefaultLogoAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const url = formData.get("logoUrl");
  await updateDefaultLogo(user.profile.organizationId, typeof url === "string" && url ? url : null);
  revalidatePath("/settings");
}

const domainHostnameSchema = z.string().trim().min(1).max(255);

export type CreateDomainFormState = { error?: string };

export async function createDomainAction(
  _prevState: CreateDomainFormState,
  formData: FormData,
): Promise<CreateDomainFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = domainHostnameSchema.safeParse(formData.get("hostname"));
  if (!parsed.success) {
    return { error: "Ingresa un hostname válido." };
  }

  await createDomain(user.profile.organizationId, parsed.data);
  revalidatePath("/settings");
  return {};
}

export type UpdateDomainFormState = { error?: string };

export async function updateDomainAction(
  _prevState: UpdateDomainFormState,
  formData: FormData,
): Promise<UpdateDomainFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = z.string().uuid().safeParse(formData.get("id"));
  const hostname = domainHostnameSchema.safeParse(formData.get("hostname"));
  if (!id.success || !hostname.success) {
    return { error: "Ingresa un hostname válido." };
  }

  await updateDomain(id.data, hostname.data);
  revalidatePath("/settings");
  return {};
}

export type ReassignDomainFormState = { error?: string };

// The only way to free a domain of its short_links FK references without hard-deleting them
// (I-7 forbids hard delete — archived QRs must keep resolving). Moves every short link off
// `fromId` onto `toId`; the caller retries deleteDomainAction once this succeeds.
export async function reassignDomainShortLinksAction(
  _prevState: ReassignDomainFormState,
  formData: FormData,
): Promise<ReassignDomainFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const fromId = z.string().uuid().safeParse(formData.get("fromId"));
  const toId = z.string().uuid().safeParse(formData.get("toId"));
  if (!fromId.success || !toId.success) {
    return { error: "Elige un dominio de destino." };
  }
  if (fromId.data === toId.data) {
    return { error: "Elige un dominio distinto al actual." };
  }

  const [fromDomain, toDomain] = await Promise.all([getDomain(fromId.data), getDomain(toId.data)]);
  if (
    fromDomain?.organizationId !== user.profile.organizationId ||
    toDomain?.organizationId !== user.profile.organizationId
  ) {
    return { error: "Dominio inválido." };
  }

  try {
    await reassignShortLinksToDomain(fromId.data, toId.data);
  } catch {
    return {
      error: "Alguno de esos enlaces ya existe con ese slug en el dominio destino — cámbialo antes de mover.",
    };
  }
  revalidatePath("/settings");
  return {};
}

const utmPresetFieldSchema = z.string().trim().min(1).max(255);
const optionalUtmFieldSchema = z.string().trim().max(255).optional();

const customParameterSchema = z.object({
  key: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

const sourceModeSchema = z.enum(["controlled", "partner", "external"]);
const templateStatusSchema = z.enum(["active", "draft", "archived"]);

// The form serializes dynamic custom-parameter rows as a JSON string; parse it here so the service
// receives a typed CustomParameter[] and any malformed payload fails validation server-side.
function parseCustomParameters(raw: FormDataEntryValue | null): CustomParameter[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const parsed: unknown = JSON.parse(raw);
  return z.array(customParameterSchema).parse(parsed);
}

const createUtmPresetSchema = z.object({
  name: utmPresetFieldSchema,
  description: z.string().trim().max(500).optional(),
  utmSource: utmPresetFieldSchema,
  utmMedium: utmPresetFieldSchema,
  utmCampaign: utmPresetFieldSchema,
  utmTerm: optionalUtmFieldSchema,
  utmContent: optionalUtmFieldSchema,
  utmId: optionalUtmFieldSchema,
  status: templateStatusSchema.optional(),
  sourceMode: sourceModeSchema.optional(),
});

function readUtmPresetForm(formData: FormData) {
  return createUtmPresetSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    utmSource: formData.get("utmSource"),
    utmMedium: formData.get("utmMedium"),
    utmCampaign: formData.get("utmCampaign"),
    utmTerm: formData.get("utmTerm") || undefined,
    utmContent: formData.get("utmContent") || undefined,
    utmId: formData.get("utmId") || undefined,
    status: formData.get("status") || undefined,
    sourceMode: formData.get("sourceMode") || undefined,
  });
}

export type CreateUtmPresetFormState = { error?: string; success?: string };

export async function createUtmPresetAction(
  _prevState: CreateUtmPresetFormState,
  formData: FormData,
): Promise<CreateUtmPresetFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = readUtmPresetForm(formData);
  if (!parsed.success) {
    return { error: "Completá los campos obligatorios." };
  }

  let customParameters: CustomParameter[];
  try {
    customParameters = parseCustomParameters(formData.get("customParameters"));
  } catch {
    return { error: "Los parámetros personalizados no son válidos." };
  }

  try {
    await createUtmPreset({
      organizationId: user.profile.organizationId,
      createdBy: user.id,
      ...parsed.data,
      sourceMode: (parsed.data.sourceMode ?? "controlled") as SourceMode,
      status: (parsed.data.status ?? "active") as TemplateStatus,
      customParameters,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar la plantilla." };
  }

  revalidatePath("/settings/utm");
  return { success: "Plantilla guardada." };
}

export async function updateUtmPresetAction(
  _prevState: CreateUtmPresetFormState,
  formData: FormData,
): Promise<CreateUtmPresetFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) {
    return { error: "Plantilla inválida." };
  }

  const parsed = readUtmPresetForm(formData);
  if (!parsed.success) {
    return { error: "Completá los campos obligatorios." };
  }

  let customParameters: CustomParameter[];
  try {
    customParameters = parseCustomParameters(formData.get("customParameters"));
  } catch {
    return { error: "Los parámetros personalizados no son válidos." };
  }

  try {
    await updateUtmPreset({
      id: id.data,
      organizationId: user.profile.organizationId,
      ...parsed.data,
      sourceMode: (parsed.data.sourceMode ?? "controlled") as SourceMode,
      status: parsed.data.status as TemplateStatus | undefined,
      customParameters,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar la plantilla." };
  }

  revalidatePath("/settings/utm");
  return { success: "Plantilla actualizada." };
}

export async function archiveUtmPresetAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  try {
    await archiveUtmPreset(id.data, user.profile.organizationId);
  } catch {
    return;
  }

  revalidatePath("/settings/utm");
}

export async function deleteUtmPresetAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  try {
    await deleteUtmPreset(id.data, user.profile.organizationId);
  } catch {
    return;
  }

  revalidatePath("/settings/utm");
}

export type DeleteDomainFormState = { error?: string };

export async function deleteDomainAction(
  _prevState: DeleteDomainFormState,
  formData: FormData,
): Promise<DeleteDomainFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = z.string().uuid().parse(formData.get("id"));
  try {
    await deleteDomain(id);
  } catch {
    // Postgres' FK violation on short_links.domain_id (NO ACTION) — the only realistic cause here.
    return { error: "Este dominio tiene enlaces activos — archívalos o cámbialos de dominio antes de borrarlo." };
  }
  revalidatePath("/settings");
  return {};
}
