"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import {
  addAttendeeToRegistration,
  deleteRejectedRegistration,
  getEvent,
  listEventReceptionistIds,
  listRegistrations,
  notifyEventWebhook,
  OCCUPATION_OPTIONS,
  resolveRegistrationFormConfig,
  updateRegistrationReviewStatus,
  type AddAttendeeToRegistrationResult,
} from "@/modules/events";
import {
  createInternalNotifications,
  sendConfirmationEmail,
  sendRegistrationDecisionEmail,
} from "@/modules/notifications";
import { listManagedUsers } from "@/modules/users";
import { exportQrPng } from "@/modules/qr";
import { resolveEventEmailContent } from "@/lib/events/event-email-content";

const PERMISSION_ERROR = "No tienes permiso para administrar registros.";
const INVALID_FORM_ERROR = "Revisa los datos del acompañante.";
const CAPACITY_REVIEW_ERROR = "No hay cupo disponible para aprobar este registro. Se notificó a los responsables para resolverlo como lista de espera.";
const reviewStatusSchema = z.object({
  registrationId: z.string().uuid(),
  eventId: z.string().uuid(),
  reviewStatus: z.enum(["new", "in_review", "approved", "waitlisted", "rejected"]),
});

const REASON_MESSAGES: Record<Exclude<AddAttendeeToRegistrationResult, { ok: true }>["reason"], string> = {
  registration_not_found: "No se encontró el registro.",
  cancelled: "Este registro está cancelado.",
  at_capacity: "El evento está a capacidad — no se puede agregar más gente a un registro confirmado.",
  duplicate_email: "Ya existe un asistente activo con ese correo en este evento.",
};

const schema = z.object({
  registrationId: z.string().uuid(),
  eventId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  company: z.string().trim().max(255).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(255).optional().or(z.literal("")),
  occupation: z.enum(OCCUPATION_OPTIONS),
});

export type AddedCompanion = { fullName: string; backupCode: string };
export type AddCompanionFormState = { error?: string; success?: boolean; addedCompanion?: AddedCompanion };

export type ResendInvitationState = { error?: string; success?: string };

export type ReviewStatusFormState = { error?: string; success?: string };
export type DeleteRegistrationState = { error?: string; success?: string };

export async function deleteRejectedRegistrationAction(
  _prevState: DeleteRegistrationState,
  formData: FormData,
): Promise<DeleteRegistrationState> {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) return { error: PERMISSION_ERROR };

  const parsed = z.object({
    registrationId: z.string().uuid(),
    eventId: z.string().uuid(),
  }).safeParse({
    registrationId: formData.get("registrationId"),
    eventId: formData.get("eventId"),
  });
  if (!parsed.success) return { error: "No se pudo identificar el registro." };

  const deleted = await deleteRejectedRegistration({
    ...parsed.data,
    organizationId: user.profile.organizationId,
  });
  if (!deleted) return { error: "Solo se pueden eliminar registros rechazados." };

  revalidatePath(`/events/${parsed.data.eventId}/registrations`);
  return { success: "Registro eliminado." };
}

export async function updateRegistrationReviewStatusAction(
  _prevState: ReviewStatusFormState,
  formData: FormData,
): Promise<ReviewStatusFormState> {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return { error: PERMISSION_ERROR };
  if (!isAdmin(user.profile) && !formData.get("eventId")) return { error: PERMISSION_ERROR };

  const parsed = reviewStatusSchema.safeParse({
    registrationId: formData.get("registrationId"),
    eventId: formData.get("eventId"),
    reviewStatus: formData.get("reviewStatus"),
  });
  if (!parsed.success) return { error: "No se pudo actualizar el estado de revisión." };

  const event = await getEvent(parsed.data.eventId, user.profile.organizationId);
  if (!event) return { error: "No se encontró el registro." };
  const receptionistIds = await listEventReceptionistIds(parsed.data.eventId, user.profile.organizationId);
  if (!isAdmin(user.profile) && !receptionistIds.includes(user.id)) return { error: PERMISSION_ERROR };
  let registration;
  try {
    registration = await updateRegistrationReviewStatus({
      ...parsed.data,
      organizationId: user.profile.organizationId,
      reviewedBy: user.id,
    });
  } catch (error) {
    const { captureOperationFailure } = await import("@/modules/monitoring");
    captureOperationFailure({ operation: "registration_review", module: "events", error });
    throw error;
  }
  if (registration && "reason" in registration && registration.reason === "capacity") {
    const recipientIds = [...new Set([
      ...receptionistIds,
      ...(await listManagedUsers(user.profile.organizationId)).filter((candidate) => candidate.role === "ADMIN" && candidate.status === "active").map((candidate) => candidate.id),
    ])];
    const href = `${env.NEXT_PUBLIC_APP_ORIGIN}/events/${event.id}/registrations?registrationId=${parsed.data.registrationId}`;
    void Promise.resolve(createInternalNotifications({
      organizationId: event.organizationId,
      recipientUserIds: recipientIds,
      subjectId: parsed.data.registrationId,
      type: "registration_review_blocked",
      title: "Aprobación bloqueada por falta de cupo",
      body: `No hay cupo disponible para aprobar un registro de ${event.name}. Resolvelo como lista de espera.`,
      href,
      dedupeKey: `registration-review-blocked:${parsed.data.registrationId}`,
    })).catch(() => undefined);
    return { error: CAPACITY_REVIEW_ERROR };
  }
  if (!registration) return { error: "No se encontró el registro." };
  if ("reason" in registration) return { error: CAPACITY_REVIEW_ERROR };

  const registrations = await listRegistrations(parsed.data.eventId, user.profile.organizationId);
  const fullRegistration = registrations.find((candidate) => candidate.id === parsed.data.registrationId);
  const primary = fullRegistration?.attendees[0];
  const href = `${env.NEXT_PUBLIC_APP_ORIGIN}/events/${event.id}/registrations?registrationId=${parsed.data.registrationId}`;
  const recipientIds = [...new Set([
    ...receptionistIds,
    ...(await listManagedUsers(user.profile.organizationId)).filter((candidate) => candidate.role === "ADMIN" && candidate.status === "active").map((candidate) => candidate.id),
  ])];
  void Promise.resolve(createInternalNotifications({
    organizationId: event.organizationId,
    recipientUserIds: recipientIds,
    subjectId: parsed.data.registrationId,
    type: "registration_decision",
    title: "Solicitud actualizada",
    body: `La solicitud para ${event.name} fue marcada como ${parsed.data.reviewStatus}.`,
    href,
    dedupeKey: `registration-decision:${parsed.data.registrationId}:${parsed.data.reviewStatus}`,
  })).catch(() => undefined);
  if (primary && parsed.data.reviewStatus === "approved") {
    const qrPng = await exportQrPng(primary.backupCode, {});
    try {
      await sendConfirmationEmail({
        organizationId: primary.organizationId,
        attendeeId: primary.id,
        to: primary.email,
        attendeeName: primary.fullName,
        eventName: event.name,
        backupCode: primary.backupCode,
        qrPngBase64: qrPng.toString("base64"),
        eventStartsAt: event.startsAt,
        eventEndsAt: event.endsAt,
        eventLocation: event.location,
        eventLocationUrl: event.locationUrl,
        manageUrl: `${env.NEXT_PUBLIC_APP_ORIGIN}/events/cancel/${registration.cancelToken}`,
        emailContent: resolveEventEmailContent(event.emailContent),
        agenda: event.agenda,
      });
    } catch (error) {
      const { captureOperationFailure } = await import("@/modules/monitoring");
      captureOperationFailure({ operation: "registration_confirmation_email", module: "events", error });
      throw error;
    }
  }
  if (primary && (parsed.data.reviewStatus === "waitlisted" || parsed.data.reviewStatus === "rejected")) {
    try {
      await sendRegistrationDecisionEmail({
        organizationId: primary.organizationId,
        registrationId: registration.id,
        to: primary.email,
        attendeeName: primary.fullName,
        eventName: event.name,
        decision: parsed.data.reviewStatus,
      });
    } catch (error) {
      const { captureOperationFailure } = await import("@/modules/monitoring");
      captureOperationFailure({ operation: "registration_decision_email", module: "events", error });
      throw error;
    }
  }

  revalidatePath(`/events/${parsed.data.eventId}/registrations`);
  return { success: "Estado de revisión actualizado." };
}

// Staff feedback round: a "master form" to add more companions to a registration that was
// already submitted (not the public registration form — that stays scoped to the person
// registering themselves). ADMINs can manage any event; RECEPTION can manage assigned events.
export async function addCompanionAction(
  _prevState: AddCompanionFormState,
  formData: FormData,
): Promise<AddCompanionFormState> {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || (!isAdmin(user.profile) && user.profile.role !== "RECEPTION")) return { error: PERMISSION_ERROR };

  const parsed = schema.safeParse({
    registrationId: formData.get("registrationId"),
    eventId: formData.get("eventId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    company: formData.get("company") ?? undefined,
    jobTitle: formData.get("jobTitle") ?? undefined,
    occupation: formData.get("occupation"),
  });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const event = await getEvent(parsed.data.eventId, user.profile.organizationId);
  if (event && resolveRegistrationFormConfig(event).fields.phone.required && !parsed.data.phone?.trim()) {
    return { error: "El teléfono es obligatorio." };
  }

  if (!isAdmin(user.profile)) {
    const receptionistIds = event
      ? await listEventReceptionistIds(parsed.data.eventId, user.profile.organizationId)
      : [];
    if (!event || !receptionistIds.includes(user.id)) return { error: PERMISSION_ERROR };
  }

  const result = await addAttendeeToRegistration({
    registrationId: parsed.data.registrationId,
    organizationId: user.profile.organizationId,
    ignoreCapacity: true,
    attendee: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      company: parsed.data.company || undefined,
      jobTitle: parsed.data.jobTitle || undefined,
      occupation: parsed.data.occupation,
    },
  });

  if (!result.ok) return { error: REASON_MESSAGES[result.reason] };

  if (event) {
    void notifyEventWebhook(event, "registration.created", {
      registrationId: parsed.data.registrationId,
      status: result.registrationStatus,
      attendee: { id: result.attendee.id, fullName: result.attendee.fullName, email: result.attendee.email },
    });
  }

  // design.md "Emails sent AFTER commit, never inside the lock" — same convention as
  // registerForEventAction/cancelRegistrationAction.
  if (result.registrationStatus === "confirmed") {
    const qrPng = await exportQrPng(result.attendee.backupCode, {});
    await sendConfirmationEmail({
      organizationId: result.attendee.organizationId,
      attendeeId: result.attendee.id,
      to: result.attendee.email,
      attendeeName: result.attendee.fullName,
      eventName: event?.name ?? "",
      backupCode: result.attendee.backupCode,
      qrPngBase64: qrPng.toString("base64"),
      eventStartsAt: event?.startsAt ?? new Date(0),
      eventEndsAt: event?.endsAt ?? null,
        eventLocation: event?.location ?? null,
        eventLocationUrl: event?.locationUrl ?? null,
       manageUrl: `${env.NEXT_PUBLIC_APP_ORIGIN}/events/cancel/${result.cancelToken}`,
       emailContent: resolveEventEmailContent(event?.emailContent),
       agenda: event?.agenda ?? [],
      });
  }

  revalidatePath(`/events/${parsed.data.eventId}/registrations`);
  return {
    success: true,
    addedCompanion: {
      fullName: result.attendee.fullName,
      backupCode: result.attendee.backupCode,
    },
  };
}

const resendInvitationSchema = z.object({
  eventId: z.string().uuid(),
  attendeeId: z.string().uuid(),
});

export async function resendInvitationAction(
  _prevState: ResendInvitationState,
  formData: FormData,
): Promise<ResendInvitationState> {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) return { error: PERMISSION_ERROR };

  const parsed = resendInvitationSchema.safeParse({
    eventId: formData.get("eventId"),
    attendeeId: formData.get("attendeeId"),
  });
  if (!parsed.success) return { error: "No se pudo identificar al asistente." };

  const event = await getEvent(parsed.data.eventId, user.profile.organizationId);
  if (!event) return { error: "No se encontró el evento." };

  const registrations = await listRegistrations(parsed.data.eventId, user.profile.organizationId);
  const registration = registrations.find((reg) => reg.attendees.some(({ id }) => id === parsed.data.attendeeId));
  const attendee = registration?.attendees.find(({ id }) => id === parsed.data.attendeeId);
  if (!attendee || !registration) return { error: "No se encontró al asistente." };

  const qrPng = await exportQrPng(attendee.backupCode, {});
  const result = await sendConfirmationEmail({
    organizationId: attendee.organizationId,
    attendeeId: attendee.id,
    to: attendee.email,
    attendeeName: attendee.fullName,
    eventName: event.name,
    backupCode: attendee.backupCode,
    qrPngBase64: qrPng.toString("base64"),
    eventStartsAt: event.startsAt,
    eventEndsAt: event.endsAt,
    eventLocation: event.location,
    eventLocationUrl: event.locationUrl,
    manageUrl: `${env.NEXT_PUBLIC_APP_ORIGIN}/events/cancel/${registration.cancelToken}`,
    emailContent: resolveEventEmailContent(event.emailContent),
    agenda: event.agenda,
    force: true,
  });

  if (!result.sent) return { error: result.reason === "provider_failure" ? "No se pudo enviar el correo." : "No se pudo reenviar la invitación." };

  revalidatePath(`/events/${parsed.data.eventId}/registrations`);
  return { success: "Invitación reenviada por correo." };
}
