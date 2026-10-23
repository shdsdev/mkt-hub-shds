import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/lib/env";
import type { EventEmailContent } from "@/lib/events/event-email-content";
import {
  notificationLog,
  notificationSubjectType,
  notificationType as notificationTypeEnum,
  userNotifications,
} from "./db";

export type NotificationSubjectType =
  (typeof notificationSubjectType.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type NotificationLogRow = typeof notificationLog.$inferSelect;
export type UserNotificationRow = typeof userNotifications.$inferSelect;

export type CreateInternalNotificationsInput = {
  organizationId: string;
  recipientUserIds: string[];
  subjectId: string;
  type: "registration_submitted" | "registration_review_blocked" | "registration_decision";
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
};

export async function createInternalNotifications(input: CreateInternalNotificationsInput): Promise<void> {
  if (input.recipientUserIds.length === 0) return;
  await db.insert(userNotifications).values(input.recipientUserIds.map((recipientUserId) => ({
    organizationId: input.organizationId,
    recipientUserId,
    subjectId: input.subjectId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
    dedupeKey: input.dedupeKey,
  }))).onConflictDoNothing();
}

export async function listUserNotifications(input: { userId: string; organizationId: string; limit?: number }): Promise<UserNotificationRow[]> {
  return db
    .select()
    .from(userNotifications)
    .where(and(eq(userNotifications.recipientUserId, input.userId), eq(userNotifications.organizationId, input.organizationId)))
    .orderBy(desc(userNotifications.createdAt))
    .limit(input.limit ?? 30);
}

export async function markUserNotificationRead(input: { id: string; userId: string; organizationId: string }): Promise<void> {
  await db.update(userNotifications).set({ readAt: new Date() }).where(and(
    eq(userNotifications.id, input.id),
    eq(userNotifications.recipientUserId, input.userId),
    eq(userNotifications.organizationId, input.organizationId),
  ));
}

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

export async function listReminderNotificationStatuses(
  attendeeIds: string[],
): Promise<Array<{ attendeeId: string; status: NotificationLogRow["status"] }>> {
  if (attendeeIds.length === 0) return [];

  return db
    .select({ attendeeId: notificationLog.subjectId, status: notificationLog.status })
    .from(notificationLog)
    .where(and(inArray(notificationLog.subjectId, attendeeIds), eq(notificationLog.notificationType, "reminder")));
}

export type ReminderNotificationStatusCounts = Record<"pending" | "failed" | "sent" | "resent" | "unknown", number>;

export async function getReminderNotificationStatusCounts(): Promise<ReminderNotificationStatusCounts> {
  const rows = await db
    .select({ status: notificationLog.status, count: count() })
    .from(notificationLog)
    .where(eq(notificationLog.notificationType, "reminder"))
    .groupBy(notificationLog.status);

  const counts: ReminderNotificationStatusCounts = {
    pending: 0,
    failed: 0,
    sent: 0,
    resent: 0,
    unknown: 0,
  };

  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
}

export async function markNotificationSent(
  id: string,
  providerMessageId?: string,
): Promise<void> {
  await db
    .update(notificationLog)
    .set({ status: "sent", providerMessageId, sentAt: new Date() })
    .where(eq(notificationLog.id, id));
}

export async function markNotificationFailed(
  id: string,
  error: string,
): Promise<void> {
  await db
    .update(notificationLog)
    .set({ status: "failed", error })
    .where(eq(notificationLog.id, id));
}

type ResendSendInput = {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ content: string; filename: string; content_id?: string }>;
};
type ResendSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };
type NotificationClient = Pick<typeof db, "select" | "insert" | "update">;

// Minimal REST client over fetch — no SDK dependency added for this leaf module (design.md
// "notifications stays a leaf"). Swappable later if a richer client is needed.
export async function sendViaResend(
  input: ResendSendInput,
): Promise<ResendSendResult> {
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
        attachments: input.attachments,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `Resend ${response.status}: ${body}` };
    }
    const data = (await response.json()) as { id?: string };
    return { ok: true, messageId: data.id ?? "" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Resend error",
    };
  }
}

export type RaffleWinnerEmailInput = {
  organizationId: string;
  drawId: string;
  to: string;
  winnerName: string;
  eventName: string;
  prizeName: string;
  redemptionCode: string;
  reason: string | null;
  instructions?: string | null;
  claimDeadlineAt?: Date | null;
  client?: NotificationClient;
};

export type RaffleWinnerEmailRenderInput = {
  winnerName: string;
  winnerEmail: string;
  eventName: string;
  prizeName: string;
  redemptionCode: string;
  reason?: string | null;
  instructions?: string | null;
  claimDeadlineAt?: Date | null;
};

export type RaffleWinnerEmailResult = {
  status: "sent" | "resent";
  sentAt: Date;
};

export function renderRaffleWinnerEmailHtml(input: RaffleWinnerEmailRenderInput): string {
  if (!input.redemptionCode) throw new Error("Winner email redemption code is required");
  const winnerName = escapeHtml(input.winnerName);
  const winnerEmail = escapeHtml(input.winnerEmail);
  const eventName = escapeHtml(input.eventName);
  const prizeName = escapeHtml(input.prizeName);
  const redemptionCode = escapeHtml(input.redemptionCode);
  const instructions = input.instructions ? escapeHtml(input.instructions) : "Presenta este código al equipo de atención para validar y canjear tu premio.";
  const reason = input.reason ? `<tr><td style="padding:0 34px 24px;"><div style="border-left:3px solid #e97558;padding:12px 16px;background:#fff8f3;color:#455960;font-size:13px;line-height:1.6;"><strong>Nota:</strong> ${escapeHtml(input.reason)}</div></td></tr>` : "";
  const deadline = input.claimDeadlineAt
    ? escapeHtml(new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(input.claimDeadlineAt))
    : "Sin fecha límite definida";

  return `<!doctype html>
<html lang="es-MX">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ganaste: ${prizeName}</title></head>
<body style="margin:0;padding:0;background:#eeeae2;font-family:Arial,Helvetica,sans-serif;color:#172a32;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:#eeeae2;">Tu premio de Shades Spaces está listo para reclamar.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eeeae2;"><tr><td align="center" style="padding:28px 12px 48px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:collapse;">
<tr><td style="padding:0 2px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:13px;font-weight:800;letter-spacing:1.5px;color:#172a32;">SHADES <span style="color:#e97558;">SPACES.</span></td><td align="right" style="font-size:10px;letter-spacing:1px;color:#66747a;text-transform:uppercase;">Premio confirmado</td></tr></table></td></tr>
<tr><td style="background:#15434a;padding:14px 22px;text-align:center;color:#fff;font-size:11px;font-weight:bold;letter-spacing:1.7px;">¡GANASTE UN PREMIO! &nbsp;✦</td></tr>
<tr><td style="background:#f7f5ef;padding:40px 34px 32px;"><p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#245d72;margin:0 0 18px;text-transform:uppercase;">${eventName}</p><h1 style="font-size:40px;line-height:1.08;letter-spacing:-1.5px;font-weight:400;margin:0 0 18px;color:#172a32;">¡Felicidades,<br><strong>${winnerName}!</strong></h1><p style="font-size:16px;line-height:1.7;margin:0;color:#455960;">Tu participación fue seleccionada y ganaste el siguiente premio:</p></td></tr>
<tr><td style="background:#9cd4c6;padding:30px 34px;"><p style="font-size:11px;letter-spacing:1.5px;font-weight:bold;color:#245d72;text-transform:uppercase;margin:0 0 10px;">TU PREMIO</p><h2 style="font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-.5px;margin:0;color:#172a32;">${prizeName}</h2><p style="font-size:13px;line-height:1.6;color:#455960;margin:12px 0 0;">Estado: <strong>Pendiente de canje</strong></p></td></tr>
<tr><td style="background:#f7f5ef;padding:30px 34px 8px;"><p style="font-size:11px;letter-spacing:1.5px;font-weight:bold;color:#245d72;text-transform:uppercase;margin:0 0 12px;">DATOS DEL GANADOR</p><p style="font-size:14px;line-height:1.7;margin:0 0 6px;"><strong>Nombre:</strong> ${winnerName}</p><p style="font-size:14px;line-height:1.7;margin:0;"><strong>Correo:</strong> ${winnerEmail}</p></td></tr>
<tr><td style="background:#f7f5ef;padding:16px 34px 8px;"><div style="border:2px solid #e97558;border-radius:12px;padding:20px;background:#fff8f3;"><p style="font-size:11px;letter-spacing:1.5px;font-weight:bold;color:#a94c38;text-transform:uppercase;margin:0 0 8px;">CÓDIGO DE CANJE</p><p style="font-family:Arial,Helvetica,sans-serif;font-size:28px;letter-spacing:3px;font-weight:800;color:#172a32;margin:0 0 9px;word-break:break-all;">${redemptionCode}</p><p style="font-size:12px;line-height:1.6;color:#66747a;margin:0;">Preséntalo para realizar el intercambio. Este código corresponde únicamente a este premio.</p></div></td></tr>
<tr><td style="background:#f7f5ef;padding:24px 34px 30px;"><p style="font-size:14px;line-height:1.75;color:#455960;margin:0 0 10px;"><strong>Cómo reclamar:</strong> ${instructions}</p><p style="font-size:14px;line-height:1.75;color:#455960;margin:0;"><strong>Fecha límite:</strong> ${deadline}</p></td></tr>
${reason}
<tr><td style="background:#15434a;color:#f7f5ef;padding:30px 34px;"><p style="margin:0 0 10px;color:#c8dee2;font-size:10px;font-weight:bold;letter-spacing:1.4px;">SHADES SPACES.</p><p style="font-size:21px;line-height:1.25;font-weight:400;margin:0 0 12px;">Descubre. Aprende. Conecta.</p><p style="font-size:13px;line-height:1.75;color:#d4dfe0;margin:0;">Una experiencia respaldada por <strong>Shades de México</strong>, patrocinador oficial.</p></td></tr>
<tr><td style="padding:24px 12px 0;text-align:center;"><p style="font-weight:bold;font-size:14px;margin:0 0 8px;letter-spacing:.4px;">SHADES <span style="color:#e97558;">×</span> SPACES</p><p style="font-size:11px;color:#66747a;line-height:1.7;margin:0;">Conserva este correo para validar y canjear tu premio.</p></td></tr>
</table></td></tr></table>
</body></html>`;
}

export async function sendRaffleWinnerEmail(input: RaffleWinnerEmailInput): Promise<RaffleWinnerEmailResult> {
  const client = input.client ?? db;
  const [existing] = await client
    .select()
    .from(notificationLog)
    .where(and(eq(notificationLog.subjectId, input.drawId), eq(notificationLog.notificationType, "winner_email")))
    .limit(1);
  const previousStatus = existing?.status;
  let notificationId = existing?.id;
  const initialStatus = existing ? "unknown" : "unknown";

  if (existing) {
    await client.update(notificationLog).set({ status: initialStatus, error: null }).where(eq(notificationLog.id, existing.id));
  } else {
    const [created] = await client.insert(notificationLog).values({
      organizationId: input.organizationId,
      subjectType: "raffle_draw",
      subjectId: input.drawId,
      notificationType: "winner_email",
      status: initialStatus,
    }).returning({ id: notificationLog.id });
    notificationId = created?.id;
  }
  if (!notificationId) throw new Error("Notification could not be recorded");

  const html = renderRaffleWinnerEmailHtml({
    winnerName: input.winnerName,
    winnerEmail: input.to,
    eventName: input.eventName,
    prizeName: input.prizeName,
    redemptionCode: input.redemptionCode,
    reason: input.reason,
    instructions: input.instructions,
    claimDeadlineAt: input.claimDeadlineAt,
  });
  const result = await sendViaResend({
    to: input.to,
    subject: `Ganaste: ${input.prizeName}`,
    html,
  });
  if (!result.ok) {
    await client.update(notificationLog).set({ status: "failed", error: result.error }).where(eq(notificationLog.id, notificationId));
    throw new Error("Winner email provider failed");
  }

  const sentAt = new Date();
  await client.update(notificationLog).set({
    status: previousStatus === "sent" || previousStatus === "resent" || previousStatus === "failed" || previousStatus === "unknown" ? "resent" : "sent",
    providerMessageId: result.messageId,
    error: null,
    sentAt,
  }).where(eq(notificationLog.id, notificationId));
  return { status: previousStatus ? "resent" : "sent", sentAt };
}

export type SendEmailResult =
  | { sent: true; notificationId: string }
  | { sent: false; reason: "already_sent" }
  | { sent: false; reason: "provider_failure"; error: string };

function registrationWaitlistEmailHtml(input: { attendeeName: string; eventName: string }): string {
  const name = escapeHtml(input.attendeeName);
  const eventName = escapeHtml(input.eventName);

  return `<!doctype html>
<html lang="es-MX">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lista de espera | ${eventName}</title></head>
<body style="margin:0;padding:0;background-color:#eeeae2;font-family:Arial,Helvetica,sans-serif;color:#172a32;">
<div style="display:none;font-size:1px;color:#eeeae2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Tu registro para ${eventName} quedó en lista de espera. Te avisaremos si se libera un espacio.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eeeae2;"><tr><td align="center" style="padding:28px 12px 48px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:collapse;">
<tr><td style="padding:0 2px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:12px;font-weight:800;letter-spacing:1.4px;color:#172a32;">SHADES <span style="color:#E97558;">SPACES.</span></td><td align="right" style="font-size:10px;letter-spacing:1px;color:#66747a;text-transform:uppercase;">Experience Lab · Edición Drapery</td></tr></table></td></tr>
<tr><td style="background:#15434A;padding:13px 22px;text-align:center;color:#fff;font-size:11px;font-weight:bold;letter-spacing:1.7px;">ACTUALIZACIÓN DE TU SOLICITUD &nbsp; ✦</td></tr>
<tr><td style="background:#f7f5ef;padding:40px 38px 34px;">
<p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#245d72;margin:0 0 18px;text-transform:uppercase;">${eventName} · WORKSHOP</p>
<h1 style="font-size:42px;line-height:1.08;letter-spacing:-2px;font-weight:400;margin:0 0 20px;color:#172a32;">Tu registro está<br><strong>en lista de espera.</strong></h1>
<p style="font-size:17px;line-height:1.7;margin:0 0 14px;">Hola, <strong>${name}</strong>:</p>
<p style="font-size:15px;line-height:1.8;color:#455960;margin:0 0 14px;">Gracias por tu interés en nuestro workshop. En este momento los cupos disponibles ya se llenaron, pero tu registro permanecerá en lista de espera.</p>
<p style="font-size:15px;line-height:1.8;color:#455960;margin:0;">Si se libera un espacio, nos pondremos en contacto contigo por correo. Mantente conectado y atento a tu bandeja de entrada.</p>
</td></tr>
<tr><td style="background:#9CD4C6;padding:32px 30px;text-align:center;">
<p style="font-size:11px;letter-spacing:1.5px;font-weight:bold;color:#245d72;text-transform:uppercase;margin:0 0 10px;">¿QUÉ SIGUE?</p>
<h2 style="font-size:27px;font-weight:400;letter-spacing:-1px;line-height:1.15;margin:0 0 11px;">Sigue conectado<br>con nosotros.</h2>
<p style="margin:0;font-size:13px;color:#455960;line-height:1.6;">Te avisaremos si se abre un lugar para que puedas acompañarnos.</p>
</td></tr>
<tr><td style="background:#f7f5ef;padding:33px 38px;">
<p style="font-size:14px;line-height:1.75;color:#455960;margin:0;">Gracias nuevamente por registrarte y por querer formar parte de esta experiencia.</p>
</td></tr>
<tr><td style="background:#15434A;color:#f7f5ef;padding:30px 38px;">
<p style="margin:0 0 10px;color:#c8dee2;font-size:10px;font-weight:bold;letter-spacing:1.4px;">SHADES SPACES.</p>
<p style="font-size:22px;line-height:1.2;font-weight:400;margin:0 0 12px;">Descubre. Aprende. Conecta.</p>
<p style="font-size:13px;line-height:1.75;color:#d4dfe0;margin:0;">Una experiencia respaldada por <strong>Shades de México</strong>.</p>
</td></tr>
<tr><td style="padding:26px 12px 0;text-align:center;">
<p style="font-weight:bold;font-size:14px;margin:0 0 8px;letter-spacing:.4px;">SHADES <span style="color:#E97558;">×</span> SPACES EDICIÓN DRAPERY/BMIGHTY</p>
<p style="font-size:12px;color:#66747a;line-height:1.7;margin:0 0 8px;">Motores y automatización · Cortineros e insumos para cortinería</p>
<p style="font-size:11px;color:#66747a;margin:16px 0 0;">Descubre. Aprende. Conecta.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

export async function sendRegistrationDecisionEmail(input: {
  organizationId: string;
  registrationId: string;
  to: string;
  attendeeName: string;
  eventName: string;
  decision: "waitlisted" | "rejected";
}): Promise<SendEmailResult> {
  const notificationType = input.decision === "waitlisted" ? "registration_waitlisted" : "registration_rejected";
  const claim = await claimNotification({
    organizationId: input.organizationId,
    subjectType: "event_attendee",
    subjectId: input.registrationId,
    notificationType,
  });
  if (!claim) return { sent: false, reason: "already_sent" };

  const subject = `Lista de espera: ${input.eventName}`;
  const html = registrationWaitlistEmailHtml(input);
  const sent = await sendViaResend({ to: input.to, subject, html });
  if (!sent.ok) {
    await markNotificationFailed(claim.id, sent.error);
    return { sent: false, reason: "provider_failure", error: sent.error };
  }
  await markNotificationSent(claim.id, sent.messageId);
  return { sent: true, notificationId: claim.id };
}

export type AttendeeEmailInput = {
  organizationId: string;
  attendeeId: string;
  to: string;
  attendeeName: string;
  eventName: string;
  backupCode: string;
  qrPngBase64: string;
  // design.md "BMIGHTY Connect — Confirmation & 48h Reminder Emails": date/time/location render
  // the event's real schedule into the branded templates; manageUrl is a fully-built URL (not a
  // bare token) so this leaf module never needs to know the events module's route shape.
  eventStartsAt: Date;
  eventEndsAt: Date | null;
  eventLocation: string | null;
  eventLocationUrl: string | null;
  manageUrl: string;
  emailContent: EventEmailContent;
  agenda: readonly { time: string; title: string; description?: string }[];
  force?: boolean;
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
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !BASE64_PATTERN.test(value)
  ) {
    throw new Error("qrPngBase64 is not valid base64 image data.");
  }
  return value;
}

// design.md "BMIGHTY Confirmation & 48h Reminder Emails" — every template renders the event's
// real schedule in Spanish, in the venue's timezone. Hardcoded to America/Mexico_City for now
// (decision 1: branding/copy stays hardcoded for every event pending a future generalization
// pass) rather than a per-event timezone field, which doesn't exist on `events` yet.
const EVENT_TIMEZONE = "America/Mexico_City";

export function formatEventDateEs(date: Date): string {
  const formatted = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EVENT_TIMEZONE,
  }).format(date);
  // Intl yields "viernes, 6 de noviembre de 2026" — drop the comma and capitalize the weekday to
  // match the brand copy's "Viernes 6 de noviembre de 2026".
  const withoutComma = formatted.replace(",", "");
  return withoutComma.charAt(0).toUpperCase() + withoutComma.slice(1);
}

export function formatEventTimeRangeEs(start: Date, end: Date | null): string {
  const timeFormatter = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: EVENT_TIMEZONE,
  });
  const startLabel = timeFormatter.format(start);
  if (!end) return `${startLabel} h`;
  return `${startLabel} a ${timeFormatter.format(end)} h`;
}

export function buildGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function getSafeHttpUrl(value: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

// Every admin/user-supplied string (attendeeName, eventName, eventLocation) goes through
// `escapeHtml` before interpolation; `qrPngBase64` is validated via `assertBase64` and embedded as
// a base64 data URI (decision 3: no hosted pass page exists yet, so the "VER MI QR DE ACCESO"
// fallback button from the source template is dropped — nothing to link it to). `manageUrl`
// (decision 4: reuses the existing `/events/cancel/[token]` page) is still escaped before going
// into an `href` attribute, matching this module's existing defense-in-depth posture even though
// it's built from a UUID-based token, not raw user input.
function renderEventDetails(input: AttendeeEmailInput): {
  date: string;
  time: string;
  location: string;
  mapsLinkHtml: string;
} {
  const date = formatEventDateEs(input.eventStartsAt);
  const time = formatEventTimeRangeEs(input.eventStartsAt, input.eventEndsAt);
  const location = input.eventLocation
    ? escapeHtml(input.eventLocation)
    : "Por confirmar";
  const mapsUrl =
    getSafeHttpUrl(input.eventLocationUrl) ||
    (input.eventLocation ? buildGoogleMapsUrl(input.eventLocation) : null);
  const mapsLinkHtml = mapsUrl
    ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" style="color:#245d72;font-size:13px;font-weight:700;text-decoration:underline;">VER UBICACIÓN EN GOOGLE MAPS ↗</a>`
    : "";
  return { date, time, location, mapsLinkHtml };
}

// BMIGHTY Connect confirmation template (decision 5: shared by both `confirmation` and
// `waitlist_promotion`, which differ only in `headline`/`introSentence`).
function confirmationEmailHtml(
  input: AttendeeEmailInput,
  headline: string,
  introSentence: string,
  qrContentId: string,
): string {
  const name = escapeHtml(input.attendeeName);
  const eventName = escapeHtml(input.eventName);
  const backupCode = escapeHtml(input.backupCode);
  const manageUrl = escapeHtml(input.manageUrl);
  const { date, time, location, mapsLinkHtml } = renderEventDetails(input);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirmación ${eventName}</title>
</head>
<body style="margin:0;padding:0;background:#eeeae2;font-family:Arial,Helvetica,sans-serif;color:#172a32;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eeeae2;">
<tr><td align="center" style="padding:30px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#f7f5ef;">
  <tr><td style="padding:35px 35px 25px;">
    <div style="font-size:24px;font-weight:800;letter-spacing:-1px;color:#E97558;">SHADES SPACES.</div>
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#66747a;margin-top:8px;">EXPERIENCE LAB / EDICIÓN DRAPERY</div>
  </td></tr>
  <tr><td style="padding:0 35px;"><div style="height:1px;background:#d8d5cd;"></div></td></tr>
  <tr><td style="padding:40px 35px 15px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#E97558;">${escapeHtml(headline)}</div>
    <h1 style="font-size:42px;line-height:1.12;letter-spacing:-2px;font-weight:400;margin:18px 0;color:#172a32;">¡Tu lugar está confirmado!</h1>
    <p style="font-size:16px;line-height:1.8;">Hola, <strong>${name}</strong>:</p>
    <p style="font-size:15px;line-height:1.8;color:#52636a;">${escapeHtml(introSentence)} <span style="font-size:15px;line-height:1.8;color:#E97558;"><strong>${eventName}</strong>.</span></p>
    <p style="font-size:15px;line-height:1.8;color:#52636a;">${escapeHtml(input.emailContent.confirmationIntro)}</p>
  </td></tr>
  <tr><td style="padding:15px 35px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr><td style="padding:26px;">
        <h2 style="font-size:22px;font-weight:400;margin:0 0 24px;">Detalles de tu experiencia.</h2>
        <p style="font-size:14px;line-height:1.8;margin:0 0 12px;"><strong>FECHA</strong><br>${date}</p>
        <p style="font-size:14px;line-height:1.8;margin:0 0 12px;"><strong>HORARIO</strong><br>${time}</p>
        <p style="font-size:14px;line-height:1.8;margin:0 0 12px;"><strong>UBICACIÓN</strong><br>${location}</p>
        <p style="font-size:14px;line-height:1.8;margin:0 0 12px;"><strong>ACCESO</strong><br>Gratuito · Registro confirmado</p>
        ${mapsLinkHtml}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 35px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr><td align="center" style="padding:35px 20px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#66747a;">TU ACCESO PERSONAL</div>
        <h2 style="font-size:27px;font-weight:400;letter-spacing:-1px;color:#172a32;margin:15px 0 8px;">Presenta este QR al llegar.</h2>
        <p style="font-size:13px;line-height:1.7;color:#66747a;max-width:360px;">Este código es personal y será utilizado para validar tu asistencia a ${eventName}.</p>
        <img src="cid:${qrContentId}" alt="Código QR personal de acceso al evento" width="230" height="230" style="display:block;width:230px;height:230px;max-width:100%;margin:25px auto 10px;border:0;">
        <div style="font-size:12px;color:#66747a;margin-top:15px;">CÓDIGO DE REGISTRO</div>
        <div style="font-size:20px;font-weight:700;letter-spacing:1px;margin-top:8px;color:#E97558;">${backupCode}</div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:15px 35px 25px;">
    <h2 style="font-size:22px;font-weight:400;margin:0 0 10px;color:#172a32;">¿Necesitas cancelar tu registro?</h2>
    <p style="font-size:14px;line-height:1.8;color:#52636a;">Si ya no puedes asistir, utiliza este enlace para cancelar tu registro.</p>
    <a href="${manageUrl}" style="display:inline-block;padding:15px 0;border-bottom:1px solid #172a32;color:#172a32;font-size:12px;font-weight:700;letter-spacing:1px;text-decoration:none;">CANCELAR MI REGISTRO ↗</a>
  </td></tr>
  <tr><td style="padding:25px 35px;background:#9CD4C6;">
    <h2 style="font-size:23px;font-weight:400;margin:0 0 12px;color:#172a32;">Prepárate para conectar.</h2>
    <p style="font-size:14px;line-height:1.8;margin:0;color:#172a32;">${escapeHtml(input.emailContent.logistics)}</p>
  </td></tr>
  <tr><td style="padding:38px 35px;background:#15434A;color:#E97558;">
    <div style="font-size:27px;font-weight:800;letter-spacing:-1px;">SHADES SPACES.</div>
    <p style="font-size:12px;line-height:1.8;color:#cad2d3;">Descubre. Aprende. Conecta.</p>
    <div style="height:1px;background:#41565f;margin:25px 0;"></div>
    <p style="font-size:12px;line-height:1.8;color:#cad2d3;">Una iniciativa respaldada por <strong>Shades de México</strong>.</p>
    <p style="font-size:11px;line-height:1.8;color:#cad2d3;">BMIGHTY · Motores y automatización<br>SHADES DRAPERY · Cortineros e insumos</p>
    <p style="font-size:10px;line-height:1.7;color:#aebbbd;margin-top:25px;">Este correo corresponde a tu inscripción al evento ${eventName}. Por seguridad, no compartas tu acceso personal.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// BMIGHTY Connect 48h reminder template (decision 6: fires on the existing single
// `reminderOffsetMinutes` per event, set to 2880 for this event — no new scheduling mechanism).
function reminderEmailHtml(input: AttendeeEmailInput, qrContentId: string): string {
  const name = escapeHtml(input.attendeeName);
  const eventName = escapeHtml(input.eventName);
  const backupCode = escapeHtml(input.backupCode);
  const manageUrl = escapeHtml(input.manageUrl);
  const { date, time, location, mapsLinkHtml } = renderEventDetails(input);
  // The "sent two days before" reference date, computed from the real event date rather than a
  // hardcoded day — matches the source template's "MIÉRCOLES 4 DE NOVIEMBRE" eyebrow, but correct
  // for any event's actual start time.
  const reminderSentDate = formatEventDateEs(
    new Date(input.eventStartsAt.getTime() - 48 * 60 * 60_000),
  );

  return `

<!doctype html>
<html lang="es-MX">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Faltan 48 horas | ${eventName}</title></head>
<body style="margin:0;padding:0;background-color:#eeeae2;font-family:Arial,Helvetica,sans-serif;color:#172a32;">
<div style="display:none;font-size:1px;color:#eeeae2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Faltan 48 horas para ${eventName}. Revisa tu horario, cómo llegar y tu QR personal.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eeeae2;"><tr><td align="center" style="padding:28px 12px 48px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:collapse;">
<tr><td style="padding:0 2px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:12px;font-weight:800;letter-spacing:1.4px;color:#172a32;">SHADES <span style="color:#E97558;">SPACES.</span></td><td align="right" style="font-size:10px;letter-spacing:1px;color:#66747a;text-transform:uppercase;">Experience Lab · Edición Drapery</td></tr></table></td></tr>
<tr><td style="background:#15434A;padding:13px 22px;text-align:center;color:#fff;font-size:11px;font-weight:bold;letter-spacing:1.7px;">¡FALTAN 48 HORAS! &nbsp; ✦</td></tr>
<tr><td style="background:#f7f5ef;padding:40px 38px 30px;">
<p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#245d72;margin:0 0 18px;text-transform:uppercase;">${reminderSentDate} · RECORDATORIO</p>
<h1 style="font-size:42px;line-height:1.08;letter-spacing:-2px;font-weight:400;margin:0 0 20px;color:#172a32;">¡Estamos a solo<br><strong>48 horas!</strong></h1>
<p style="font-size:17px;line-height:1.7;margin:0 0 14px;">¡Hola, <strong>${name}</strong>!</p>
<p style="font-size:15px;line-height:1.8;color:#455960;margin:0;">${escapeHtml(input.emailContent.reminderIntro)}</p>
</td></tr>
<tr><td style="background:#f7f5ef;padding:0 38px 30px;">
<p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:1.7px;color:#245d72;">ESTO ES LO QUE TE ESPERA</p>
${input.agenda.map((item, index) => `<p style="font-size:14px;color:#455960;line-height:1.7;margin:0 0 9px;"><strong>${String(index + 1).padStart(2, "0")} / ${escapeHtml(item.title)}.</strong>${item.description ? ` ${escapeHtml(item.description)}` : ""}</p>`).join("")}
</td></tr>
<tr><td style="background:#f7f5ef;padding:0 38px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #d8d5cd;border-bottom:1px solid #d8d5cd;">
<tr><td style="padding:17px 0;width:100px;font-size:10px;letter-spacing:1px;font-weight:bold;color:#66747a;text-transform:uppercase;">Fecha</td><td style="padding:17px 0;font-size:14px;font-weight:bold;">${date}</td></tr>
<tr><td style="padding:15px 0;border-top:1px solid #d8d5cd;font-size:10px;letter-spacing:1px;font-weight:bold;color:#66747a;text-transform:uppercase;">Horario</td><td style="padding:15px 0;border-top:1px solid #d8d5cd;font-size:14px;font-weight:bold;">${time}</td></tr>
<tr><td style="padding:15px 0;border-top:1px solid #d8d5cd;font-size:10px;letter-spacing:1px;font-weight:bold;color:#66747a;text-transform:uppercase;">Sede</td><td style="padding:15px 0;border-top:1px solid #d8d5cd;font-size:14px;"><strong>${location}</strong><br>${mapsLinkHtml}</td></tr>
<tr><td style="padding:15px 0;border-top:1px solid #d8d5cd;font-size:10px;letter-spacing:1px;font-weight:bold;color:#66747a;text-transform:uppercase;">Acceso</td><td style="padding:15px 0;border-top:1px solid #d8d5cd;font-size:14px;font-weight:bold;">Gratuito · Confirmado</td></tr>
</table></td></tr>
<tr><td style="background:#9CD4C6;padding:32px 30px;text-align:center;">
<p style="font-size:11px;letter-spacing:1.5px;font-weight:bold;color:#245d72;text-transform:uppercase;margin:0 0 10px;">TU QR PARA EL VIERNES</p>
<h2 style="font-size:27px;font-weight:400;letter-spacing:-1px;line-height:1.15;margin:0 0 11px;">Guarda tu QR<br>para el acceso</h2>
<p style="margin:0 0 19px;font-size:13px;color:#455960;line-height:1.6;">Preséntalo al ingresar. El QR es personal: no lo compartas.</p>
<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td style="background:#ffffff;border:1px solid #d8d5cd;padding:15px;"><img src="cid:${qrContentId}" width="210" height="210" alt="Código QR personal de acceso al evento." style="display:block;width:210px;height:210px;border:0;outline:none;text-decoration:none;color:#172a32;font-size:12px;"></td></tr></table>
<p style="margin:17px 0 6px;font-size:11px;letter-spacing:1.2px;color:#66747a;font-weight:bold;">CÓDIGO DE REGISTRO</p>
<p style="margin:0 0 23px;font-size:20px;font-weight:bold;letter-spacing:1px;color:#172a32;overflow-wrap:anywhere;">${backupCode}</p>
</td></tr>
<tr><td style="background:#f7f5ef;padding:33px 38px;">
<h2 style="font-weight:400;letter-spacing:-.6px;font-size:24px;margin:0 0 12px;">¿Necesitas cancelar tu registro?</h2>
<p style="color:#455960;font-size:14px;line-height:1.75;margin:0 0 18px;">Si ya no puedes asistir, utiliza este enlace para cancelar tu registro.</p>
<p style="margin:0;"><a href="${manageUrl}" style="color:#172a32;text-decoration:underline;font-weight:bold;font-size:12px;letter-spacing:1px;">CANCELAR MI REGISTRO ↗</a></p>
</td></tr>
<tr><td style="background:#15434A;color:#f7f5ef;padding:30px 38px;">
<p style="margin:0 0 10px;color:#c8dee2;font-size:10px;font-weight:bold;letter-spacing:1.4px;">UN BENEFICIO POR ASISTIR</p>
<p style="font-size:22px;line-height:1.2;font-weight:400;margin:0 0 12px;">Tu asistencia tiene beneficios.</p>
<p style="font-size:13px;line-height:1.75;color:#d4dfe0;margin:0;">${escapeHtml(input.emailContent.benefit)}</p>
</td></tr>
<tr><td style="background:#f7f5ef;padding:28px 38px 32px;">
<p style="font-size:14px;line-height:1.75;color:#455960;margin:0;">${escapeHtml(input.emailContent.logistics)}</p>
</td></tr>
<tr><td style="padding:26px 12px 0;text-align:center;">
<p style="font-weight:bold;font-size:14px;margin:0 0 8px;letter-spacing:.4px;">SHADES <span style="color:#ff0040;">×</span> SPACES EDICIÓN DRAPERY/BMIGHTY</p>
<p style="font-size:12px;color:#66747a;line-height:1.7;margin:0 0 8px;">Motores y automatización · Cortineros e insumos para cortinería</p>
<p style="font-size:12px;color:#66747a;line-height:1.7;margin:0;">Una experiencia respaldada por <strong>Shades de México</strong>.</p>
<p style="font-size:11px;color:#66747a;margin:16px 0 0;">Descubre. Aprende. Conecta.</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

async function sendAttendeeEmail(
  notificationType: NotificationType,
  subject: string,
  html: string,
  input: AttendeeEmailInput,
): Promise<SendEmailResult> {
  const qr = assertBase64(input.qrPngBase64);
  const claim = input.force
    ? undefined
    : await claimNotification({
        organizationId: input.organizationId,
        subjectType: "event_attendee",
        subjectId: input.attendeeId,
        notificationType,
      });
  if (!input.force && !claim) return { sent: false, reason: "already_sent" };

  const result = await sendViaResend({
    to: input.to,
    subject,
    html,
    attachments: [{ content: qr, filename: "event-access-qr.png", content_id: "event-attendee-qr" }],
  });
  if (!result.ok) {
    if (claim) await markNotificationFailed(claim.id, result.error);
    return { sent: false, reason: "provider_failure", error: result.error };
  }
  if (claim) await markNotificationSent(claim.id, result.messageId);
  return { sent: true, notificationId: claim?.id ?? "resend" };
}

// spec.md "Confirmation Email Content" — sent per attendee (primary + each companion) on
// `confirmed` status, carrying that attendee's own QR pass and backup code.
export async function sendConfirmationEmail(
  input: AttendeeEmailInput,
): Promise<SendEmailResult> {
  return sendAttendeeEmail(
    "confirmation",
    `Confirmación: ${input.eventName}`,
    confirmationEmailHtml(input, "INSCRIPCIÓN CONFIRMADA", "Tu inscripción a", "event-attendee-qr"),
    input,
  );
}

// spec.md "Waitlist Promotion Email" — identical content shape to the standard confirmation
// (decision 5), only the eyebrow/intro sentence differs.
export async function sendWaitlistPromotionEmail(
  input: AttendeeEmailInput,
): Promise<SendEmailResult> {
  return sendAttendeeEmail(
    "waitlist_promotion",
    `¡Tienes lugar! ${input.eventName}`,
    confirmationEmailHtml(
      input,
      "¡TIENES LUGAR!",
      "Se liberó un lugar y ya estás confirmado para",
      "event-attendee-qr",
    ),
    input,
  );
}

// spec.md "Configurable Reminder Email" — exactly one reminder per registration per event; the
// `claimNotification` unique constraint is what makes a second call for the same attendee a no-op.
export async function sendReminderEmail(
  input: AttendeeEmailInput,
): Promise<SendEmailResult> {
  return sendAttendeeEmail(
    "reminder",
    `Recordatorio: ${input.eventName}`,
    reminderEmailHtml(input, "event-attendee-qr"),
    input,
  );
}
