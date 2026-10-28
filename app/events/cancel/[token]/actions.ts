"use server";

import { env } from "@/lib/env";
import { cancelRegistrationByToken, getEvent } from "@/modules/events";
import { sendWaitlistPromotionEmail } from "@/modules/notifications";
import { exportQrPng } from "@/modules/qr";
import { resolveEventEmailContent } from "@/lib/events/event-email-content";

const INVALID_FORM_ERROR = "Formulario inválido.";
const INVALID_TOKEN_ERROR = "Este enlace de cancelación no es válido.";
const ALREADY_CANCELLED_ERROR = "Este registro ya estaba cancelado.";

export type CancelFormState = { error?: string; success?: boolean };

// design.md "Pass + cancel tokens": token possession alone is the authorization — no login, and
// a token can only ever affect the one registration it was minted for (spec.md "token A cannot
// cancel B"), enforced entirely inside cancelRegistrationByToken's own lookup.
export async function cancelRegistrationAction(
  _prevState: CancelFormState,
  formData: FormData,
): Promise<CancelFormState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) return { error: INVALID_FORM_ERROR };

  const result = await cancelRegistrationByToken(token);
  if (!result.ok) {
    return { error: result.reason === "already_cancelled" ? ALREADY_CANCELLED_ERROR : INVALID_TOKEN_ERROR };
  }

  // design.md "Emails sent AFTER commit, never inside the lock" — dispatched here, outside
  // cancelRegistrationByToken's transaction. spec.md "Waitlist Promotion Email" is sent per
  // promoted attendee only when a cancellation actually freed a confirmed seat.
  if (result.promoted) {
    const { registration: promotedRegistration, attendees } = result.promoted;
    const event = await getEvent(promotedRegistration.eventId, promotedRegistration.organizationId);
    const manageUrl = `${env.NEXT_PUBLIC_APP_ORIGIN}/events/cancel/${promotedRegistration.cancelToken}`;
    await Promise.all(
      attendees.map(async (attendee) => {
        const qrPng = await exportQrPng(attendee.passToken, {});
        const sendResult = await sendWaitlistPromotionEmail({
          organizationId: attendee.organizationId,
          attendeeId: attendee.id,
          to: attendee.email,
          attendeeName: attendee.fullName,
          eventName: event?.name ?? "",
          backupCode: attendee.backupCode,
          qrPngBase64: qrPng.toString("base64"),
          eventStartsAt: event?.startsAt ?? new Date(0),
          eventEndsAt: event?.endsAt ?? null,
            eventLocation: event?.location ?? null,
            eventLocationUrl: event?.locationUrl ?? null,
           manageUrl,
           emailContent: resolveEventEmailContent(event?.emailContent),
           agenda: event?.agenda ?? [],
         });
        try {
          const { recordAudit } = await import("@/modules/audit");
          await recordAudit({
            organizationId: attendee.organizationId,
            actorType: "system",
            eventId: promotedRegistration.eventId,
            action: sendResult.sent ? "event_send" : "event_send_failed",
            resourceType: "event_notification",
            resourceId: attendee.id,
            after: { kind: "waitlist_promotion", recipient: attendee.email, result: sendResult.sent ? "sent" : "failed", origin: "waitlist_promotion" },
          });
        } catch {
          // Audit failures must never block a waitlist promotion email.
        }
      }),
    );
  }

  return { success: true };
}
