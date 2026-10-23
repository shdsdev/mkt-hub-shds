"use server";

import { z } from "zod";
import { checkRateLimit, recordAudit } from "@/modules/audit";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, checkInAttendee, confirmAttendeeCheckIn, getEvent, listEventBenefitRedemptions, lookupAttendeeForCheckIn, lookupBenefitRedemption, notifyEventWebhook, redeemBenefit, type BenefitLookupResult, type BenefitRedemptionHistoryRow, type CheckInLookupResult } from "@/modules/events";
import { isActive } from "@/modules/users";

const PERMISSION_ERROR = "No tienes permiso para hacer check-in.";
const INVALID_FORM_ERROR = "Escanea o escribe un código válido.";
const NOT_FOUND_ERROR = "No se encontró un asistente con ese código.";
const BENEFIT_PERMISSION_ERROR = "No tienes permiso para operar los beneficios.";

// backup codes are always exactly 8 Crockford-base32 chars (generateBackupCode); pass tokens are
// opaque base64url, always much longer (generateOpaqueToken: >=40 chars) — length alone
// disambiguates which column the same scan/typed input field means, no separate UI toggle needed.
const BACKUP_CODE_LENGTH = 8;

const inputSchema = z.object({
  eventId: z.string().uuid(),
  code: z.string().trim().min(1).max(255),
});

const benefitLookupSchema = z.object({ eventId: z.string().uuid(), code: z.string().trim().min(1).max(255) });
const benefitRedeemSchema = benefitLookupSchema.extend({ benefitId: z.string().uuid() });

export type CheckInFormState = {
  error?: string;
  success?: boolean;
  message?: string;
  alreadyCheckedIn?: boolean;
  attendeeName?: string;
  redemption?: { benefitId: string; createdAt: Date; actorName: string };
};

export type CheckInLookupState =
  | { ok: true; result: CheckInLookupResult; confirmationRequired: boolean }
  | { ok: false; error: string };

export type BenefitLookupState =
  | { ok: true; result: BenefitLookupResult }
  | { ok: false; error: string };

export type BenefitRedemptionHistoryState =
  | { ok: true; history: BenefitRedemptionHistoryRow[] }
  | { ok: false; error: string };

async function requireCheckInUser(eventId: string) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return undefined;
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId, capability: "check-in" }))) return undefined;
  return user;
}

async function requireBenefitUser(eventId: string) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return undefined;
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId, capability: "benefit-redemption" }))) return undefined;
  return user;
}

function normalizeBenefitCode(code: string) {
  return code.length === BACKUP_CODE_LENGTH ? code.toUpperCase() : code;
}

function benefitError(reason: string) {
  if (reason === "not_checked_in") return "Primero debe realizar el check-in.";
  if (reason === "already_redeemed") return "Beneficio ya canjeado.";
  if (reason === "stock_exhausted") return "No hay existencias disponibles para este beneficio.";
  if (reason === "not_configured") return "Los beneficios no están configurados para este evento.";
  if (reason === "inactive_benefit") return "El beneficio ya no está activo.";
  return NOT_FOUND_ERROR;
}

export async function lookupBenefitRedemptionAction(formData: FormData): Promise<BenefitLookupState> {
  const parsed = benefitLookupSchema.safeParse({ eventId: formData.get("eventId"), code: formData.get("code") });
  if (!parsed.success) return { ok: false, error: INVALID_FORM_ERROR };
  const user = await requireBenefitUser(parsed.data.eventId);
  if (!user) return { ok: false, error: BENEFIT_PERMISSION_ERROR };
  const result = await lookupBenefitRedemption({ eventId: parsed.data.eventId, code: normalizeBenefitCode(parsed.data.code) });
  if (!result.ok) return { ok: false, error: NOT_FOUND_ERROR };
  return { ok: true, result };
}

export async function listBenefitRedemptionsAction(formData: FormData): Promise<BenefitRedemptionHistoryState> {
  const parsed = benefitLookupSchema.pick({ eventId: true }).safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return { ok: false, error: INVALID_FORM_ERROR };
  const user = await requireBenefitUser(parsed.data.eventId);
  if (!user) return { ok: false, error: BENEFIT_PERMISSION_ERROR };
  return { ok: true, history: await listEventBenefitRedemptions(parsed.data.eventId) };
}

export async function redeemBenefitAction(formData: FormData): Promise<CheckInFormState> {
  const parsed = benefitRedeemSchema.safeParse({ eventId: formData.get("eventId"), benefitId: formData.get("benefitId"), code: formData.get("code") });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };
  const user = await requireBenefitUser(parsed.data.eventId);
  if (!user) return { error: BENEFIT_PERMISSION_ERROR };
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };

  const result = await redeemBenefit({ eventId: parsed.data.eventId, benefitId: parsed.data.benefitId, code: normalizeBenefitCode(parsed.data.code), actorId: user.id });
  if (!result.ok) return { error: benefitError(result.reason) };
  await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, action: "create", resourceType: "event_benefit_redemption", resourceId: result.redemption.id, after: { eventId: parsed.data.eventId, benefitId: parsed.data.benefitId } });
  const redemption = result.redemption.benefitId && result.redemption.createdAt
    ? { benefitId: result.redemption.benefitId, createdAt: result.redemption.createdAt, actorName: user.email }
    : undefined;
  return { success: true, message: "Beneficio canjeado correctamente.", ...(redemption ? { redemption } : {}) };
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
