"use server";

import { z } from "zod";
import { checkRateLimit, recordAudit } from "@/modules/audit";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, checkInAttendee, confirmAttendeeCheckIn, getEvent, lookupAttendeeForCheckIn, notifyEventWebhook, type CheckInLookupResult } from "@/modules/events";
import { isActive } from "@/modules/users";

const PERMISSION_ERROR = "No tienes permiso para hacer check-in.";
const INVALID_FORM_ERROR = "Escanea o escribe un código válido.";
const NOT_FOUND_ERROR = "No se encontró un asistente con ese código.";

// backup codes are always exactly 8 Crockford-base32 chars (generateBackupCode); pass tokens are
// opaque base64url, always much longer (generateOpaqueToken: >=40 chars) — length alone
// disambiguates which column the same scan/typed input field means, no separate UI toggle needed.
const BACKUP_CODE_LENGTH = 8;

const inputSchema = z.object({
  eventId: z.string().uuid(),
  code: z.string().trim().min(1).max(255),
});

export type CheckInFormState = {
  error?: string;
  success?: boolean;
  alreadyCheckedIn?: boolean;
  attendeeName?: string;
};

export type CheckInLookupState =
  | { ok: true; result: CheckInLookupResult; confirmationRequired: boolean }
  | { ok: false; error: string };

async function requireCheckInUser(eventId: string) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return undefined;
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId, capability: "check-in" }))) return undefined;
  return user;
}

export async function lookupCheckInAction(formData: FormData): Promise<CheckInLookupState> {
  const eventId = z.string().uuid().safeParse(formData.get("eventId"));
  const code = z.string().trim().min(1).max(255).safeParse(formData.get("code"));
  if (!eventId.success || !code.success) return { ok: false, error: INVALID_FORM_ERROR };
  const user = await requireCheckInUser(eventId.data);
  if (!user) return { ok: false, error: PERMISSION_ERROR };
  const event = await getEvent(eventId.data, user.profile.organizationId);
  if (!event) return { ok: false, error: NOT_FOUND_ERROR };
  return { ok: true, result: await lookupAttendeeForCheckIn({ eventId: event.id, code: code.data }), confirmationRequired: event.checkInConfirmationRequired };
}

export async function confirmCheckInAction(formData: FormData): Promise<CheckInFormState> {
  const eventId = z.string().uuid().safeParse(formData.get("eventId"));
  const attendeeId = z.string().uuid().safeParse(formData.get("attendeeId"));
  if (!eventId.success || !attendeeId.success) return { error: INVALID_FORM_ERROR };
  const user = await requireCheckInUser(eventId.data);
  if (!user) return { error: PERMISSION_ERROR };
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };
  const result = await confirmAttendeeCheckIn({ eventId: eventId.data, attendeeId: attendeeId.data, checkedInBy: user.id });
  if (!result.ok) return { error: NOT_FOUND_ERROR };
  if (!result.alreadyCheckedIn) {
    await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, action: "create", resourceType: "event_check_in", resourceId: result.attendee.id, after: { eventId: eventId.data, attendeeId: result.attendee.id } });
    const event = await getEvent(eventId.data, user.profile.organizationId);
    if (event) void notifyEventWebhook(event, "attendee.checked_in", { attendeeId: result.attendee.id, fullName: result.attendee.fullName, email: result.attendee.email });
  }
  return { success: true, alreadyCheckedIn: result.alreadyCheckedIn, attendeeName: result.attendee.fullName };
}

// design.md RBAC: "check-in needs any active session ... no new role" — unlike the ADMIN-only
// event CRUD actions in app/(protected)/events/actions.ts, this only requires an active session.
export async function checkInAction(
  _prevState: CheckInFormState,
  formData: FormData,
): Promise<CheckInFormState> {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return { error: PERMISSION_ERROR };

  const parsed = inputSchema.safeParse({
    eventId: formData.get("eventId"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const isBackupCode = parsed.data.code.length === BACKUP_CODE_LENGTH;
  const result = await checkInAttendee({
    eventId: parsed.data.eventId,
    checkedInBy: user.id,
    ...(isBackupCode ? { backupCode: parsed.data.code.toUpperCase() } : { passToken: parsed.data.code }),
  });

  if (!result.ok) return { error: NOT_FOUND_ERROR };

  // Only on a genuine first check-in — a re-scan of an already-checked-in attendee is a no-op
  // and must not notify again.
  if (!result.alreadyCheckedIn) {
    const event = await getEvent(parsed.data.eventId, user.profile.organizationId);
    if (event) {
      void notifyEventWebhook(event, "attendee.checked_in", {
        attendeeId: result.attendee.id,
        fullName: result.attendee.fullName,
        email: result.attendee.email,
      });
    }
  }

  return {
    success: true,
    alreadyCheckedIn: result.alreadyCheckedIn,
    attendeeName: result.attendee.fullName,
  };
}
