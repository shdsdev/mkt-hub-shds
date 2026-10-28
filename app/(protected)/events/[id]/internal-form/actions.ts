"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/modules/audit";
import { getCurrentUser } from "@/modules/auth";
import { addAttendeeToRegistration, getEvent, listRegistrations, resolveRegistrationFormConfig, updatePrimaryAttendee, type AddAttendeeToRegistrationResult, type RegistrationWithAttendees } from "@/modules/events";
import { isActive, isAdmin } from "@/modules/users";
import { OCCUPATION_OPTIONS } from "@/modules/events";

const attendeeSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  company: z.string().trim().max(255).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(255).optional().or(z.literal("")),
  occupation: z.enum(OCCUPATION_OPTIONS),
});

const ADD_COMPANION_REASON_MESSAGES: Record<Exclude<AddAttendeeToRegistrationResult, { ok: true }>['reason'], string> = {
  registration_not_found: "No se encontró el registro.",
  cancelled: "Este registro está cancelado.",
  at_capacity: "El evento está a capacidad — no se puede agregar más gente a un registro confirmado.",
  duplicate_email: "Ya existe un asistente activo con ese correo en este evento.",
};

async function requireAdmin(eventId: string) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  const event = await getEvent(eventId, user.profile.organizationId);
  return event ? { user, event } : undefined;
}

export type AddedCompanion = { fullName: string; backupCode: string };
export type InternalSearchState = { error?: string; registration?: RegistrationWithAttendees; addedCompanion?: AddedCompanion };

export async function searchInternalRegistrationAction(formData: FormData): Promise<InternalSearchState> {
  const eventId = z.string().uuid().safeParse(formData.get("eventId"));
  const query = z.string().trim().min(1).max(255).safeParse(formData.get("query"));
  if (!eventId.success || !query.success) return { error: "Escribe un nombre, correo o folio." };
  const context = await requireAdmin(eventId.data);
  if (!context) return { error: "No tienes permiso para usar este formulario." };
  const registrations = await listRegistrations(eventId.data, context.user.profile.organizationId, { q: query.data });
  const exactFolio = query.data.length === 8
    ? (await listRegistrations(eventId.data, context.user.profile.organizationId)).find((registration) => registration.attendees.some((attendee) => attendee.backupCode === query.data.toUpperCase()))
    : undefined;
  return exactFolio ? { registration: exactFolio } : registrations[0] ? { registration: registrations[0] } : { error: "No se encontró el registro." };
}

export async function addInternalCompanionAction(formData: FormData): Promise<InternalSearchState> {
  const eventId = z.string().uuid().safeParse(formData.get("eventId"));
  const registrationId = z.string().uuid().safeParse(formData.get("registrationId"));
  const attendee = attendeeSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    occupation: formData.get("occupation"),
  });
  if (!eventId.success || !registrationId.success || !attendee.success) return { error: "Revisa los datos del acompañante." };
  const context = await requireAdmin(eventId.data);
  if (!context) return { error: "No tienes permiso para usar este formulario." };
  if (resolveRegistrationFormConfig(context.event).fields.phone.required && !attendee.data.phone?.trim()) {
    return { error: "El teléfono es obligatorio." };
  }
  const registration = (await listRegistrations(eventId.data, context.user.profile.organizationId)).find(
    (candidate) => candidate.id === registrationId.data,
  );
  const primary = registration?.attendees.find((attendee) => attendee.isPrimary);
  if (!primary) return { error: "No se encontró el registro." };
  if (!primary.company?.trim()) return { error: "El titular no tiene empresa configurada." };
  const result = await addAttendeeToRegistration({
    registrationId: registrationId.data,
    organizationId: context.user.profile.organizationId,
    ignoreCapacity: true,
    attendee: { ...attendee.data, company: primary.company, phone: attendee.data.phone || undefined, jobTitle: attendee.data.jobTitle || undefined },
  });
  if (!result.ok) return { error: ADD_COMPANION_REASON_MESSAGES[result.reason] };
  await recordAudit({ organizationId: context.user.profile.organizationId, userId: context.user.id, action: "create", resourceType: "event_attendee", resourceId: result.attendee.id, after: { registrationId: registrationId.data, backupCode: result.attendee.backupCode } });
  revalidatePath(`/events/${eventId.data}/internal-form`);
  return {
    error: `Acompañante agregado. Folio: ${result.attendee.backupCode}`,
    addedCompanion: {
      fullName: result.attendee.fullName,
      backupCode: result.attendee.backupCode,
    },
  };
}

export async function updatePrimaryAttendeeAction(formData: FormData): Promise<InternalSearchState> {
  const eventId = z.string().uuid().safeParse(formData.get("eventId"));
  const registrationId = z.string().uuid().safeParse(formData.get("registrationId"));
  const attendee = attendeeSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    company: formData.get("company") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    occupation: formData.get("occupation"),
  });
  if (!eventId.success || !registrationId.success || !attendee.success) return { error: "Revisa los datos del titular." };
  const context = await requireAdmin(eventId.data);
  if (!context) return { error: "No tienes permiso para usar este formulario." };
  if (resolveRegistrationFormConfig(context.event).fields.phone.required && !attendee.data.phone?.trim()) {
    return { error: "El teléfono es obligatorio." };
  }
  const updated = await updatePrimaryAttendee({ registrationId: registrationId.data, organizationId: context.user.profile.organizationId, attendee: { ...attendee.data, phone: attendee.data.phone || undefined, company: attendee.data.company || undefined, jobTitle: attendee.data.jobTitle || undefined } });
  if (!updated.ok) return { error: updated.reason === "duplicate_email" ? "Ya existe un asistente activo con ese correo en este evento." : "No se encontró el titular." };
  await recordAudit({ organizationId: context.user.profile.organizationId, userId: context.user.id, action: "create", resourceType: "event_attendee", resourceId: updated.attendee.id, after: { registrationId: registrationId.data, updated: true } });
  revalidatePath(`/events/${eventId.data}/internal-form`);
  return { error: "Titular actualizado." };
}
