import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/lib/env";
import { notificationLog, notificationSubjectType, notificationType as notificationTypeEnum } from "./db";

export type NotificationSubjectType = (typeof notificationSubjectType.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type NotificationLogRow = typeof notificationLog.$inferSelect;

export type ClaimNotificationInput = {
  organizationId: string;
  subjectType: NotificationSubjectType;
  subjectId: string;
  notificationType: NotificationType;
};

// Idempotency claim (design.md "Reminder idempotency") — INSERT ... ON CONFLICT DO NOTHING
// RETURNING id against the UNIQUE(subject_id, notification_type) constraint. A duplicate claim
// for the same subject+type returns no row, so only the first caller for a given send actually
// dispatches an email; retries/duplicate webhook pings are free.
// Test-pinning note (verify-report C1 remediation): service.test.ts asserts the mock insert chain
// actually receives `.onConflictDoNothing({ target: [subjectId, notificationType] })` with the
// exact unique-constraint columns from db.ts, so deleting/weakening this call fails that test.
// What those tests CANNOT prove — because there is no local Postgres harness in this repo's test
// infra — is the real Postgres-level guarantee: two concurrent INSERTs racing on the same
// (subject_id, notification_type) unique index resolve to exactly one row via ON CONFLICT DO
// NOTHING at the database engine level. That requires a future integration test against a real
// Postgres instance (issuing two concurrent/sequential real claims and asserting only one
// `{ id }` comes back); it remains unverified by this test suite today.
export async function claimNotification(
  input: ClaimNotificationInput,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .insert(notificationLog)
    .values({
      organizationId: input.organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      notificationType: input.notificationType,
      status: "pending",
    })
    .onConflictDoNothing({
      target: [notificationLog.subjectId, notificationLog.notificationType],
    })
    .returning({ id: notificationLog.id });
  return row;
}

export async function markNotificationSent(id: string, providerMessageId?: string): Promise<void> {
  await db
    .update(notificationLog)
    .set({ status: "sent", providerMessageId, sentAt: new Date() })
    .where(eq(notificationLog.id, id));
}

export async function markNotificationFailed(id: string, error: string): Promise<void> {
  await db.update(notificationLog).set({ status: "failed", error }).where(eq(notificationLog.id, id));
}

type ResendSendInput = { to: string; subject: string; html: string };
type ResendSendResult = { ok: true; messageId: string } | { ok: false; error: string };

// Minimal REST client over fetch — no SDK dependency added for this leaf module (design.md
// "notifications stays a leaf"). Swappable later if a richer client is needed.
export async function sendViaResend(input: ResendSendInput): Promise<ResendSendResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `Resend ${response.status}: ${body}` };
    }
    const data = (await response.json()) as { id?: string };
    return { ok: true, messageId: data.id ?? "" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown Resend error" };
  }
}

export type SendEmailResult =
  | { sent: true; notificationId: string }
  | { sent: false; reason: "already_sent" }
  | { sent: false; reason: "provider_failure"; error: string };

export type AttendeeEmailInput = {
  organizationId: string;
  attendeeId: string;
  to: string;
  attendeeName: string;
  eventName: string;
  backupCode: string;
  qrPngBase64: string;
};

// attendeeName/eventName originate from registration input (public-facing form in PR3) and must
// never be interpolated into HTML unescaped — this is the one HTML-escaping authority for every
// email template in this module.
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

// A base64 payload (RFC 4648 alphabet + padding) is the only shape `exportQrPng`/our own Resend
// adapter ever produce — reject anything else rather than splice unverified data into an <img
// src="data:...">, even though this value is never attacker-controlled in practice.
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function assertBase64(value: string): string {
  if (value.length === 0 || value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) {
    throw new Error("qrPngBase64 is not valid base64 image data.");
  }
  return value;
}

// Stub content only (PR2 scope note) — real copy/branding is a later concern; what matters here
// is the claim-then-send-then-record sequence, not the HTML. Every untrusted string is escaped
// before interpolation (see `escapeHtml`); `qrPngBase64` is validated, not escaped, since it goes
// into a `src` attribute's data URI, not HTML text/attribute content.
function attendeePassEmailHtml(input: AttendeeEmailInput, intro: string): string {
  return `
    <p>Hola ${escapeHtml(input.attendeeName)},</p>
    <p>${escapeHtml(intro)} <strong>${escapeHtml(input.eventName)}</strong>.</p>
    <p>Código de respaldo: <strong>${escapeHtml(input.backupCode)}</strong></p>
    <img src="data:image/png;base64,${assertBase64(input.qrPngBase64)}" alt="QR de acceso" />
  `;
}

async function sendAttendeeEmail(
  notificationType: NotificationType,
  subject: string,
  intro: string,
  input: AttendeeEmailInput,
): Promise<SendEmailResult> {
  const claim = await claimNotification({
    organizationId: input.organizationId,
    subjectType: "event_attendee",
    subjectId: input.attendeeId,
    notificationType,
  });
  if (!claim) return { sent: false, reason: "already_sent" };

  const result = await sendViaResend({
    to: input.to,
    subject,
    html: attendeePassEmailHtml(input, intro),
  });
  if (!result.ok) {
    await markNotificationFailed(claim.id, result.error);
    return { sent: false, reason: "provider_failure", error: result.error };
  }
  await markNotificationSent(claim.id, result.messageId);
  return { sent: true, notificationId: claim.id };
}

// spec.md "Confirmation Email Content" — sent per attendee (primary + each companion) on
// `confirmed` status, carrying that attendee's own QR pass and backup code.
export async function sendConfirmationEmail(input: AttendeeEmailInput): Promise<SendEmailResult> {
  return sendAttendeeEmail(
    "confirmation",
    `Confirmación: ${input.eventName}`,
    "Tu lugar está confirmado para",
    input,
  );
}

// spec.md "Waitlist Promotion Email" — identical content shape to the standard confirmation.
export async function sendWaitlistPromotionEmail(input: AttendeeEmailInput): Promise<SendEmailResult> {
  return sendAttendeeEmail(
    "waitlist_promotion",
    `¡Tienes lugar! ${input.eventName}`,
    "Se liberó un lugar y ya estás confirmado para",
    input,
  );
}

// spec.md "Configurable Reminder Email" — exactly one reminder per registration per event; the
// `claimNotification` unique constraint is what makes a second call for the same attendee a no-op.
export async function sendReminderEmail(input: AttendeeEmailInput): Promise<SendEmailResult> {
  return sendAttendeeEmail(
    "reminder",
    `Recordatorio: ${input.eventName}`,
    "Tu evento se acerca:",
    input,
  );
}
