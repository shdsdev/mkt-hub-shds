"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/modules/audit";
import { getCurrentUser } from "@/modules/auth";
import { addAttendeeToRegistration, getEvent, listRegistrations, updatePrimaryAttendee, type RegistrationWithAttendees } from "@/modules/events";
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

async function requireAdmin(eventId: string) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  const event = await getEvent(eventId, user.profile.organizationId);
  return event ? { user, event } : undefined;
}

export type InternalSearchState = { error?: string; registration?: RegistrationWithAttendees };

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
    company: formData.get("company") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    occupation: formData.get("occupation"),
  });
  if (!eventId.success || !registrationId.success || !attendee.success) return { error: "Revisa los datos del acompañante." };
  const context = await requireAdmin(eventId.data);
  if (!context) return { error: "No tienes permiso para usar este formulario." };
  const result = await addAttendeeToRegistration({
    registrationId: registrationId.data,
    organizationId: context.user.profile.organizationId,
    ignoreCapacity: true,
    attendee: { ...attendee.data, phone: attendee.data.phone || undefined, company: attendee.data.company || undefined, jobTitle: attendee.data.jobTitle || undefined },
  });
  if (!result.ok) return { error: "No se pudo agregar el acompañante." };
  await recordAudit({ organizationId: context.user.profile.organizationId, userId: context.user.id, action: "create", resourceType: "event_attendee", resourceId: result.attendee.id, after: { registrationId: registrationId.data, backupCode: result.attendee.backupCode } });
  revalidatePath(`/events/${eventId.data}/internal-form`);
  return { error: `Acompañante agregado. Folio: ${result.attendee.backupCode}` };
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
  const updated = await updatePrimaryAttendee({ registrationId: registrationId.data, organizationId: context.user.profile.organizationId, attendee: { ...attendee.data, phone: attendee.data.phone || undefined, company: attendee.data.company || undefined, jobTitle: attendee.data.jobTitle || undefined } });
  if (!updated) return { error: "No se encontró el titular." };
  await recordAudit({ organizationId: context.user.profile.organizationId, userId: context.user.id, action: "create", resourceType: "event_attendee", resourceId: updated.id, after: { registrationId: registrationId.data, updated: true } });
  revalidatePath(`/events/${eventId.data}/internal-form`);
  return { error: "Titular actualizado." };
}
