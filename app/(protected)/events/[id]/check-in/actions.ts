"use server";

import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { checkInAttendee, getEvent, notifyEventWebhook } from "@/modules/events";

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
