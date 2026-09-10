"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import {
  createLink,
  createDomain,
  createShortLink,
  updateLinkDestination,
  archiveLink,
  archiveShortLink,
  getLink,
} from "@/modules/links";
import { normalizeUtmValue, createUtmPreset } from "@/modules/utm";
import { recordPrintRun } from "@/modules/campaigns";
import { recordAudit, checkRateLimit } from "@/modules/audit";

const RATE_LIMIT_ERROR = "Demasiadas acciones. Inténtalo de nuevo en breve.";

const createLinkSchema = z.object({
  destinationUrl: z.string().trim().min(1).max(2048),
  utmSource: z.string().trim().max(255).optional(),
  utmMedium: z.string().trim().max(255).optional(),
  utmCampaign: z.string().trim().max(255).optional(),
});

export type CreateLinkFormState = { error?: string };

export async function createLinkAction(
  _prevState: CreateLinkFormState,
  formData: FormData,
): Promise<CreateLinkFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const parsed = createLinkSchema.safeParse({
    destinationUrl: formData.get("destinationUrl"),
    utmSource: formData.get("utmSource") || undefined,
    utmMedium: formData.get("utmMedium") || undefined,
    utmCampaign: formData.get("utmCampaign") || undefined,
  });
  if (!parsed.success) {
    return { error: "Ingresa una URL de destino válida." };
  }

  try {
    const link = await createLink({
      organizationId: user.profile.organizationId,
      destinationUrl: parsed.data.destinationUrl,
      utmSource: parsed.data.utmSource ? normalizeUtmValue(parsed.data.utmSource) : undefined,
      utmMedium: parsed.data.utmMedium ? normalizeUtmValue(parsed.data.utmMedium) : undefined,
      utmCampaign: parsed.data.utmCampaign ? normalizeUtmValue(parsed.data.utmCampaign) : undefined,
    });
    await recordAudit({
      organizationId: user.profile.organizationId,
      userId: user.id,
      action: "create",
      resourceType: "link",
      resourceId: link.id,
      after: link,
    });
    revalidatePath("/links");
    redirect(`/links/${link.id}`);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("http") || error.message.includes("valor UTM"))
    ) {
      return { error: error.message };
    }
    throw error;
  }
}

const createUtmPresetSchema = z.object({
  name: z.string().trim().min(1).max(255),
  utmSource: z.string().trim().min(1).max(255),
  utmMedium: z.string().trim().min(1).max(255),
  utmCampaign: z.string().trim().min(1).max(255),
});

export type CreateUtmPresetFormState = { error?: string };

export async function createUtmPresetAction(
  _prevState: CreateUtmPresetFormState,
  formData: FormData,
): Promise<CreateUtmPresetFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = createUtmPresetSchema.safeParse({
    name: formData.get("name"),
    utmSource: formData.get("utmSource"),
    utmMedium: formData.get("utmMedium"),
    utmCampaign: formData.get("utmCampaign"),
  });
  if (!parsed.success) {
    return { error: "Completa nombre, source, medium y campaign." };
  }

  try {
    await createUtmPreset({ organizationId: user.profile.organizationId, ...parsed.data });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el preajuste." };
  }

  revalidatePath("/links");
  return {};
}

const createDomainSchema = z.object({ hostname: z.string().trim().min(1).max(255) });

export type CreateDomainFormState = { error?: string };

export async function createDomainAction(
  _prevState: CreateDomainFormState,
  formData: FormData,
): Promise<CreateDomainFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = createDomainSchema.safeParse({ hostname: formData.get("hostname") });
  if (!parsed.success) {
    return { error: "Ingresa un hostname válido." };
  }

  await createDomain(user.profile.organizationId, parsed.data.hostname);
  revalidatePath("/links");
  return {};
}

const createShortLinkSchema = z.object({
  linkId: z.string().uuid(),
  domainId: z.string().uuid(),
  slug: z.string().trim().max(64).optional(),
});

export type CreateShortLinkFormState = { error?: string };

export async function createShortLinkAction(
  _prevState: CreateShortLinkFormState,
  formData: FormData,
): Promise<CreateShortLinkFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rawSlug = (formData.get("slug") as string | null)?.trim();
  const parsed = createShortLinkSchema.safeParse({
    linkId: formData.get("linkId"),
    domainId: formData.get("domainId"),
    slug: rawSlug || undefined,
  });
  if (!parsed.success) {
    return { error: "Elige un dominio para crear el enlace corto." };
  }

  try {
    await createShortLink({
      organizationId: user.profile.organizationId,
      ...parsed.data,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el enlace corto." };
  }

  revalidatePath(`/links/${parsed.data.linkId}`);
  return {};
}

const updateDestinationSchema = z.object({
  linkId: z.string().uuid(),
  destinationUrl: z.string().trim().min(1).max(2048),
});

export type UpdateDestinationFormState = { error?: string };

export async function updateDestinationAction(
  _prevState: UpdateDestinationFormState,
  formData: FormData,
): Promise<UpdateDestinationFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const parsed = updateDestinationSchema.safeParse({
    linkId: formData.get("linkId"),
    destinationUrl: formData.get("destinationUrl"),
  });
  if (!parsed.success) {
    return { error: "Ingresa una URL de destino válida." };
  }

  const before = await getLink(parsed.data.linkId);

  try {
    const after = await updateLinkDestination(parsed.data.linkId, parsed.data.destinationUrl);
    await recordAudit({
      organizationId: user.profile.organizationId,
      userId: user.id,
      action: "destination_change",
      resourceType: "link",
      resourceId: parsed.data.linkId,
      before: before ? { destinationUrl: before.destinationUrl } : undefined,
      after: { destinationUrl: after.destinationUrl },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el destino." };
  }

  revalidatePath(`/links/${parsed.data.linkId}`);
  return {};
}

export async function archiveLinkAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const linkId = z.string().uuid().parse(formData.get("linkId"));
  await archiveLink(linkId);
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "archive",
    resourceType: "link",
    resourceId: linkId,
  });
  revalidatePath(`/links/${linkId}`);
}

export async function archiveShortLinkAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const shortLinkId = z.string().uuid().parse(formData.get("shortLinkId"));
  const linkId = z.string().uuid().parse(formData.get("linkId"));
  await archiveShortLink(shortLinkId);
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "archive",
    resourceType: "short_link",
    resourceId: shortLinkId,
  });
  revalidatePath(`/links/${linkId}`);
}

const recordPrintRunSchema = z.object({
  shortLinkId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
});

export type RecordPrintRunFormState = { error?: string };

export async function recordPrintRunAction(
  _prevState: RecordPrintRunFormState,
  formData: FormData,
): Promise<RecordPrintRunFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const parsed = recordPrintRunSchema.safeParse({
    shortLinkId: formData.get("shortLinkId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { error: "Ingresa una cantidad de al menos 1." };
  }

  const printRun = await recordPrintRun({
    organizationId: user.profile.organizationId,
    shortLinkId: parsed.data.shortLinkId,
    quantity: parsed.data.quantity,
  });
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "record_print_run",
    resourceType: "print_run",
    resourceId: printRun.id,
    after: printRun,
  });

  const linkId = z.string().uuid().parse(formData.get("linkId"));
  revalidatePath(`/links/${linkId}`);
  return {};
}
