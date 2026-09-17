"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { updateTheme, isValidThemeId, updateDefaultLogo } from "@/modules/users";
import { createDomain, updateDomain, deleteDomain } from "@/modules/links";
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
