"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkRateLimit, recordAudit } from "@/modules/audit";
import { getCurrentUser } from "@/modules/auth";
import {
  assignEventReceptionist,
  removeEventReceptionist,
} from "@/modules/events";
import { isActive, isAdmin, listManagedUsers } from "@/modules/users";

export type ReceptionTeamState = { error?: string; success?: string };

const inputSchema = z.object({ eventId: z.string().uuid(), userId: z.string().uuid() });

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  return user;
}

export async function assignReceptionistAction(
  _state: ReceptionTeamState,
  formData: FormData,
): Promise<ReceptionTeamState> {
  const user = await requireAdmin();
  if (!user) return { error: "No tienes permiso para administrar el equipo de recepción." };
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };

  const parsed = inputSchema.safeParse({ eventId: formData.get("eventId"), userId: formData.get("userId") });
  if (!parsed.success) return { error: "Los datos de asignación no son válidos." };

  const target = (await listManagedUsers(user.profile.organizationId)).find((candidate) => candidate.id === parsed.data.userId);
  if (!target || target.role !== "RECEPTION" || target.status !== "active") {
    return { error: "Selecciona un usuario de recepción activo." };
  }

  const assigned = await assignEventReceptionist(parsed.data.eventId, parsed.data.userId, user.profile.organizationId);
  if (!assigned) return { error: "No se encontró el evento." };
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "event_receptionist",
    resourceId: parsed.data.eventId,
    after: { userId: parsed.data.userId },
  });
  revalidatePath(`/events/${parsed.data.eventId}/edit`);
  return { success: "Usuario asignado." };
}

export async function removeReceptionistAction(
  _state: ReceptionTeamState,
  formData: FormData,
): Promise<ReceptionTeamState> {
  const user = await requireAdmin();
  if (!user) return { error: "No tienes permiso para administrar el equipo de recepción." };
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };

  const parsed = inputSchema.safeParse({ eventId: formData.get("eventId"), userId: formData.get("userId") });
  if (!parsed.success) return { error: "Los datos de asignación no son válidos." };

  const removed = await removeEventReceptionist(parsed.data.eventId, parsed.data.userId, user.profile.organizationId);
  if (!removed) return { error: "No se encontró el evento." };
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "event_receptionist",
    resourceId: parsed.data.eventId,
    before: { userId: parsed.data.userId },
  });
  revalidatePath(`/events/${parsed.data.eventId}/edit`);
  return { success: "Usuario retirado." };
}
