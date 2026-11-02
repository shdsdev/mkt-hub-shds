"use server";

import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { isAdmin } from "@/modules/users";
import { createEmailSegment, deleteEmailSegment, duplicateEmailSegment, listEmailSegmentMatches, updateEmailSegment, type EmailSegmentDefinition } from "@/modules/email-marketing";
import { revalidatePath } from "next/cache";

const segmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tags: z.string().trim().max(80).optional().or(z.literal("")),
  subscribedOnly: z.string().optional(),
  definition: z.string().optional(),
});

export type SegmentActionState = { error?: string; success?: string; matches?: number; eligible?: number; sample?: Array<{ email: string; fullName: string | null }> };

async function requireSegmentAdmin() {
  const user = await getCurrentUser();
  return user && isAdmin(user.profile) ? user : undefined;
}

export async function duplicateEmailSegmentAction(formData: FormData) {
  const user = await requireSegmentAdmin();
  const segmentId = z.string().uuid().safeParse(formData.get("segmentId"));
  if (!user || !segmentId.success) return;
  await duplicateEmailSegment({ organizationId: user.profile.organizationId, createdBy: user.id, segmentId: segmentId.data });
  revalidatePath("/email-marketing/segments");
}

export async function deleteEmailSegmentAction(formData: FormData) {
  const user = await requireSegmentAdmin();
  const segmentId = z.string().uuid().safeParse(formData.get("segmentId"));
  if (!user || !segmentId.success) return;
  await deleteEmailSegment({ organizationId: user.profile.organizationId, segmentId: segmentId.data });
  revalidatePath("/email-marketing/segments");
}

export async function createEmailSegmentAction(
  _previous: SegmentActionState,
  formData: FormData,
): Promise<SegmentActionState> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.profile)) return { error: "No tienes permisos para crear segmentos." };
  const parsed = segmentSchema.safeParse({
    name: formData.get("name"),
    tags: formData.get("tags") ?? undefined,
    subscribedOnly: formData.get("subscribedOnly") ?? undefined,
    definition: formData.get("definition") || undefined,
  });
  if (!parsed.success) return { error: "Completa un nombre válido para el segmento." };
  let definition: EmailSegmentDefinition;
  if (parsed.data.definition) {
    try {
      definition = JSON.parse(parsed.data.definition) as EmailSegmentDefinition;
    } catch {
      return { error: "Las reglas del segmento no son válidas." };
    }
  } else {
    const tags = parsed.data.tags ? parsed.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : undefined;
    definition = { version: 1, filters: { logic: "all", ...(parsed.data.subscribedOnly ? { subscriptionStatuses: ["subscribed"] as const } : {}), ...(tags?.length ? { tags } : {}) } };
  }
  await createEmailSegment({
    organizationId: user.profile.organizationId,
    createdBy: user.id,
    name: parsed.data.name,
    definition,
  });
  revalidatePath("/email-marketing/segments");
  revalidatePath("/email-marketing/campaigns/new");
  return { success: "Segmento guardado." };
}

export async function updateEmailSegmentAction(
  _previous: SegmentActionState,
  formData: FormData,
): Promise<SegmentActionState> {
  const user = await getCurrentUser();
  const segmentId = z.string().uuid().safeParse(formData.get("segmentId"));
  if (!user || !isAdmin(user.profile) || !segmentId.success) return { error: "No tienes permisos para editar este segmento." };
  const parsed = segmentSchema.safeParse({ name: formData.get("name"), definition: formData.get("definition") || undefined });
  if (!parsed.success || !parsed.data.definition) return { error: "Completa un nombre y reglas válidas para el segmento." };
  let definition: EmailSegmentDefinition;
  try {
    definition = JSON.parse(parsed.data.definition) as EmailSegmentDefinition;
  } catch {
    return { error: "Las reglas del segmento no son válidas." };
  }
  await updateEmailSegment({ organizationId: user.profile.organizationId, segmentId: segmentId.data, name: parsed.data.name, definition });
  revalidatePath("/email-marketing/segments");
  revalidatePath("/email-marketing/campaigns/new");
  return { success: "Segmento actualizado." };
}

export async function previewEmailSegmentAction(
  _previous: SegmentActionState,
  formData: FormData,
): Promise<SegmentActionState> {
  const user = await requireSegmentAdmin();
  if (!user) return { error: "No tienes permisos para revisar segmentos." };
  try {
    const definition = JSON.parse(String(formData.get("definition"))) as EmailSegmentDefinition;
    const matches = await listEmailSegmentMatches({ organizationId: user.profile.organizationId, definition });
    const eligible = matches.filter((contact) => contact.subscriptionStatus === "subscribed").length;
    return { matches: matches.length, eligible, sample: matches.slice(0, 5).map((contact) => ({ email: contact.email, fullName: contact.fullName })) };
  } catch {
    return { error: "No se pudieron revisar las reglas del segmento." };
  }
}
