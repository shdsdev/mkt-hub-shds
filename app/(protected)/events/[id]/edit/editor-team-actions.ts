"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkRateLimit, recordAudit } from "@/modules/audit";
import { getCurrentUser } from "@/modules/auth";
import { assignEventEditor, removeEventEditor } from "@/modules/events";
import { isActive, isAdmin, listManagedUsers } from "@/modules/users";

export type EditorTeamState = { error?: string; success?: string };

const inputSchema = z.object({ eventId: z.string().uuid(), userId: z.string().uuid() });

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  return user;
}

export async function assignEditorAction(
  _state: EditorTeamState,
  formData: FormData,
): Promise<EditorTeamState> {
  const user = await requireAdmin();
  if (!user) return { error: "No tienes permiso para administrar editores." };
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };

  const parsed = inputSchema.safeParse({ eventId: formData.get("eventId"), userId: formData.get("userId") });
  if (!parsed.success) return { error: "Los datos de asignación no son válidos." };

  const target = (await listManagedUsers(user.profile.organizationId)).find((candidate) => candidate.id === parsed.data.userId);
  if (!target || target.role !== "EVENT_EDITOR" || target.status !== "active") {
    return { error: "Selecciona un editor de eventos activo." };
  }

  const assigned = await assignEventEditor(parsed.data.eventId, parsed.data.userId, user.profile.organizationId);
  if (!assigned) return { error: "No se encontró el evento." };
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "event_editor",
    resourceId: parsed.data.eventId,
    after: { userId: parsed.data.userId },
  });
  revalidatePath(`/events/${parsed.data.eventId}/edit`);
  return { success: "Editor asignado." };
}

export async function removeEditorAction(
  _state: EditorTeamState,
  formData: FormData,
): Promise<EditorTeamState> {
  const user = await requireAdmin();
  if (!user) return { error: "No tienes permiso para administrar editores." };
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };

  const parsed = inputSchema.safeParse({ eventId: formData.get("eventId"), userId: formData.get("userId") });
  if (!parsed.success) return { error: "Los datos de asignación no son válidos." };

  const removed = await removeEventEditor(parsed.data.eventId, parsed.data.userId, user.profile.organizationId);
  if (!removed) return { error: "No se encontró el evento." };
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "event_editor",
    resourceId: parsed.data.eventId,
    before: { userId: parsed.data.userId },
  });
  revalidatePath(`/events/${parsed.data.eventId}/edit`);
  return { success: "Editor retirado." };
}
