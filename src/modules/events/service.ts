import { randomBytes } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers } from "@/db/auth-schema-ref";
import { isAdmin, type UserRole } from "@/modules/users";
import {
  events,
  eventRegistrations,
  eventAttendees,
  eventReceptionists,
  eventEditors,
  eventBenefits,
  eventBenefitRedemptions,
  type AgendaItem,
  type RegistrationConsents,
  type RegistrationFormAnswers,
  type SponsorLogo,
} from "./db";
import { getEffectiveRegistrationStatus } from "./registration-status";
import { getCheckInResultKind, type CheckInResultKind } from "./check-in-result";
import type { EventEmailContent } from "@/lib/events/event-email-content";
import { DEFAULT_EVENT_REMINDER_OFFSET_MINUTES } from "@/lib/events/event-reminder";

export type { AgendaItem, SponsorLogo };

// Crockford base32 (design.md "Backup code") — 32 chars, excludes I/L/O/U by construction so a
// human reading the code aloud at the door never confuses visually similar characters.
export const CROCKFORD_BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BACKUP_CODE_LENGTH = 8;

// 8-char, unique per event (enforced by `event_attendees_event_backup_code_unique` in db.ts);
// callers regenerate on a unique-constraint collision rather than this function retrying itself.
export function generateBackupCode(): string {
  const bytes = randomBytes(BACKUP_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < BACKUP_CODE_LENGTH; i += 1) {
    code += CROCKFORD_BASE32_ALPHABET[bytes[i] % CROCKFORD_BASE32_ALPHABET.length];
  }
  return code;
}

// Opaque pass/cancel token (design.md "Pass + cancel tokens") — same precedent as
// `src/modules/agents/tools/contracts.ts#createConfirmationToken`: unguessable, revocable by
// column update, no signing secret, no expiry clock.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

// The only normalization authority behind `event_attendees.email_normalized`, which the partial
// unique index (design.md "Active-email uniqueness") keys on.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type EventRow = typeof events.$inferSelect;
export type BenefitKind = "discount" | "gift";
export type BenefitRedemptionScope = "attendee" | "registration";

export type BenefitRow = typeof eventBenefits.$inferSelect;
export type BenefitRedemptionRow = typeof eventBenefitRedemptions.$inferSelect;
export type BenefitAvailability = BenefitRow & { remaining: number | null };
export type BenefitInput = {
  kind: BenefitKind;
  name?: string | null;
  percentage?: number | null;
  quantity?: number | null;
  active?: boolean;
};

export type BenefitValidationResult =
  | { ok: true; value: Required<Pick<BenefitInput, "kind" | "name" | "percentage" | "quantity">> }
  | { ok: false; reason: "gift_name_required" | "discount_percentage_required" | "invalid_percentage" | "invalid_quantity" };

export function validateBenefitInput(input: BenefitInput): BenefitValidationResult {
  const name = input.name?.trim() || null;
  const percentage = input.percentage ?? null;
  const quantity = input.quantity ?? null;

  if (input.kind === "gift" && !name) return { ok: false, reason: "gift_name_required" };
  if (input.kind === "discount" && percentage === null) return { ok: false, reason: "discount_percentage_required" };
  if (input.kind === "discount" && percentage !== null && (percentage < 0 || percentage > 100 || !Number.isInteger(percentage))) {
    return { ok: false, reason: "invalid_percentage" };
  }
  if (quantity !== null && (quantity < 0 || !Number.isInteger(quantity))) return { ok: false, reason: "invalid_quantity" };

  return {
    ok: true,
    value: {
      kind: input.kind,
      name: input.kind === "gift" ? name : name,
      percentage: input.kind === "discount" ? percentage : null,
      quantity,
    },
  };
}

export type BenefitMutationResult =
  | { ok: true; benefit: BenefitRow }
  | { ok: false; reason: "gift_name_required" | "discount_percentage_required" | "invalid_percentage" | "invalid_quantity" | "not_found" };

export async function listEventBenefits(eventId: string): Promise<BenefitRow[]> {
  return db.select().from(eventBenefits).where(eq(eventBenefits.eventId, eventId)).orderBy(asc(eventBenefits.createdAt));
}

export type BenefitRedemptionHistoryRow = BenefitRedemptionRow & {
  benefitName: string | null;
  benefitKind: BenefitKind;
  benefitPercentage: number | null;
  attendeeName: string;
  actorName: string | null;
};

export async function listEventBenefitRedemptions(eventId: string): Promise<BenefitRedemptionHistoryRow[]> {
  const rows = await db
    .select({
      redemption: eventBenefitRedemptions,
      benefitName: eventBenefits.name,
      benefitKind: eventBenefits.kind,
      benefitPercentage: eventBenefits.percentage,
      attendeeName: eventAttendees.fullName,
      actorName: authUsers.email,
    })
    .from(eventBenefitRedemptions)
    .innerJoin(eventBenefits, eq(eventBenefits.id, eventBenefitRedemptions.benefitId))
    .innerJoin(eventAttendees, eq(eventAttendees.id, eventBenefitRedemptions.attendeeId))
    .leftJoin(authUsers, eq(authUsers.id, eventBenefitRedemptions.actorId))
    .where(eq(eventBenefitRedemptions.eventId, eventId))
    .orderBy(desc(eventBenefitRedemptions.createdAt));

  return rows.map(({ redemption, benefitName, benefitKind, benefitPercentage, attendeeName, actorName }) => ({
    ...redemption,
    benefitName,
    benefitKind,
    benefitPercentage,
    attendeeName,
    actorName,
  }));
}

export async function saveEventBenefit(input: BenefitInput & { eventId: string; benefitId?: string }): Promise<BenefitMutationResult> {
  const validation = validateBenefitInput(input);
  if (!validation.ok) return validation;

  const values = { ...validation.value, active: input.active };
  if (input.benefitId) {
    const [benefit] = await db
      .update(eventBenefits)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(eventBenefits.id, input.benefitId), eq(eventBenefits.eventId, input.eventId)))
      .returning();
    return benefit ? { ok: true, benefit } : { ok: false, reason: "not_found" };
  }

  const [benefit] = await db.insert(eventBenefits).values({ eventId: input.eventId, ...values }).returning();
  return { ok: true, benefit };
}

export async function deactivateEventBenefit(input: { eventId: string; benefitId: string }): Promise<BenefitMutationResult> {
  const [benefit] = await db
    .update(eventBenefits)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(eventBenefits.id, input.benefitId), eq(eventBenefits.eventId, input.eventId)))
    .returning();
  return benefit ? { ok: true, benefit } : { ok: false, reason: "not_found" };
}

export type BenefitScopeMutationResult =
  | { ok: true; event: EventRow }
  | { ok: false; reason: "not_found" | "scope_locked" };

export type BenefitConfigurationInput = {
  eventId: string;
  scope: BenefitRedemptionScope;
  benefits: Array<BenefitInput & { benefitId?: string }>;
};

export type BenefitConfigurationMutationResult =
  | { ok: true; event: EventRow; benefits: BenefitRow[] }
  | { ok: false; reason: "not_found" | "scope_locked" | "gift_name_required" | "discount_percentage_required" | "invalid_percentage" | "invalid_quantity" };

export async function saveEventBenefitsConfiguration(input: BenefitConfigurationInput): Promise<BenefitConfigurationMutationResult> {
  return db.transaction(async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, input.eventId)).limit(1);
    if (!event) return { ok: false, reason: "not_found" };
    if (event.benefitRedemptionStartedAt && event.benefitRedemptionScope !== input.scope) {
      return { ok: false, reason: "scope_locked" };
    }

    const existingBenefits = await tx.select().from(eventBenefits).where(eq(eventBenefits.eventId, input.eventId));
    const normalizedBenefits: Array<BenefitInput & { benefitId?: string }> = [];
    for (const benefit of input.benefits) {
      const validation = validateBenefitInput(benefit);
      if (!validation.ok) return validation;
      normalizedBenefits.push({ ...validation.value, active: benefit.active ?? true, benefitId: benefit.benefitId });
    }

    const savedBenefits: BenefitRow[] = [];
    for (const benefit of normalizedBenefits) {
      const values = {
        kind: benefit.kind,
        name: benefit.name ?? null,
        percentage: benefit.percentage ?? null,
        quantity: benefit.quantity ?? null,
        active: benefit.active ?? true,
        updatedAt: new Date(),
      };
      if (benefit.benefitId) {
        const [updated] = await tx
          .update(eventBenefits)
          .set(values)
          .where(and(eq(eventBenefits.id, benefit.benefitId), eq(eventBenefits.eventId, input.eventId)))
          .returning();
        if (!updated) return { ok: false, reason: "not_found" };
        savedBenefits.push(updated);
      } else {
        const [created] = await tx.insert(eventBenefits).values({ eventId: input.eventId, ...values }).returning();
        savedBenefits.push(created);
      }
    }

    const submittedIds = normalizedBenefits.flatMap((benefit) => benefit.benefitId ? [benefit.benefitId] : []);
    for (const benefit of existingBenefits) {
      if (submittedIds.includes(benefit.id)) continue;
      const [deactivated] = await tx
        .update(eventBenefits)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(eventBenefits.id, benefit.id), eq(eventBenefits.eventId, input.eventId)))
        .returning();
      if (deactivated) savedBenefits.push(deactivated);
    }

    const [updatedEvent] = await tx
      .update(events)
      .set({ benefitRedemptionScope: input.scope, updatedAt: new Date() })
      .where(and(eq(events.id, input.eventId), or(isNull(events.benefitRedemptionStartedAt), eq(events.benefitRedemptionScope, input.scope))))
      .returning();
    if (!updatedEvent) return { ok: false, reason: "scope_locked" };
    return { ok: true, event: updatedEvent, benefits: savedBenefits };
  });
}

export async function setEventBenefitRedemptionScope(input: { eventId: string; scope: BenefitRedemptionScope }): Promise<BenefitScopeMutationResult> {
  const [event] = await db.select().from(events).where(eq(events.id, input.eventId)).limit(1);
  if (!event) return { ok: false, reason: "not_found" };
  if (event.benefitRedemptionStartedAt && event.benefitRedemptionScope !== input.scope) return { ok: false, reason: "scope_locked" };

  const [updated] = await db
    .update(events)
    .set({ benefitRedemptionScope: input.scope, updatedAt: new Date() })
    .where(and(eq(events.id, input.eventId), isNull(events.benefitRedemptionStartedAt)))
    .returning();
  return updated ? { ok: true, event: updated } : { ok: false, reason: "scope_locked" };
}

export type BenefitLookupResult =
  | { ok: false; reason: "not_found" }
  | {
      ok: true;
      event: EventRow;
      attendee: EventAttendeeRow;
      registration: EventRegistrationRow;
      redemption: BenefitRedemptionRow | null;
      redemptionBenefit: BenefitRow | null;
      benefits: BenefitAvailability[];
    };

function benefitCodeCondition(eventId: string, code: string) {
  const normalized = code.trim();
  return and(
    eq(eventAttendees.eventId, eventId),
    or(eq(eventAttendees.backupCode, normalized.toUpperCase()), eq(eventAttendees.passToken, normalized)),
  );
}

export async function lookupBenefitRedemption(input: { eventId: string; code: string }): Promise<BenefitLookupResult> {
  if (!input.code.trim()) return { ok: false, reason: "not_found" };
  const [attendee] = await db.select().from(eventAttendees).where(benefitCodeCondition(input.eventId, input.code)).limit(1);
  if (!attendee) return { ok: false, reason: "not_found" };
  const [registration] = await db
    .select()
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.id, attendee.registrationId), eq(eventRegistrations.eventId, input.eventId)))
    .limit(1);
  const [event] = await db.select().from(events).where(eq(events.id, input.eventId)).limit(1);
  if (!registration || !event) return { ok: false, reason: "not_found" };

  const effectiveSubject = event.benefitRedemptionScope === "registration"
    ? eq(eventBenefitRedemptions.registrationId, registration.id)
    : eq(eventBenefitRedemptions.attendeeId, attendee.id);
  const [redemption] = await db
    .select()
    .from(eventBenefitRedemptions)
    .where(and(eq(eventBenefitRedemptions.eventId, input.eventId), eq(eventBenefitRedemptions.status, "active"), effectiveSubject))
    .limit(1);
  const benefits = await db
    .select()
    .from(eventBenefits)
    .where(and(eq(eventBenefits.eventId, input.eventId), eq(eventBenefits.active, true)))
    .orderBy(asc(eventBenefits.createdAt));
  const [redemptionBenefit] = redemption
    ? await db.select().from(eventBenefits).where(eq(eventBenefits.id, redemption.benefitId)).limit(1)
    : [undefined];
  const benefitsWithAvailability = await Promise.all(benefits.map(async (benefit) => {
    if (benefit.quantity === null) return { ...benefit, remaining: null };
    const [stock] = await db
      .select({ count: count() })
      .from(eventBenefitRedemptions)
      .where(and(eq(eventBenefitRedemptions.benefitId, benefit.id), eq(eventBenefitRedemptions.status, "active")));
    return { ...benefit, remaining: Math.max(benefit.quantity - Number(stock?.count ?? 0), 0) };
  }));
  return { ok: true, event, attendee, registration, redemption: redemption ?? null, redemptionBenefit: redemptionBenefit ?? null, benefits: benefitsWithAvailability };
}

export type RedeemBenefitResult =
  | { ok: true; redemption: BenefitRedemptionRow }
  | { ok: false; reason: "not_found" | "not_configured" | "not_checked_in" | "already_redeemed" | "inactive_benefit" | "stock_exhausted" };

export async function redeemBenefit(input: { eventId: string; benefitId: string; code: string; actorId: string }): Promise<RedeemBenefitResult> {
  if (!input.code.trim()) return { ok: false, reason: "not_found" };
  return db.transaction(async (tx) => {
    const [event] = await tx.select().from(events).where(eq(events.id, input.eventId)).for("update");
    if (!event) return { ok: false, reason: "not_found" };
    if (!event.benefitRedemptionScope) return { ok: false, reason: "not_configured" };

    const [attendee] = await tx.select().from(eventAttendees).where(benefitCodeCondition(input.eventId, input.code)).limit(1);
    if (!attendee) return { ok: false, reason: "not_found" };
    const [registration] = await tx
      .select()
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.id, attendee.registrationId), eq(eventRegistrations.eventId, input.eventId)))
      .limit(1);
    if (!registration) return { ok: false, reason: "not_found" };
    if (!attendee.checkedInAt) return { ok: false, reason: "not_checked_in" };

    const subject = event.benefitRedemptionScope === "registration"
      ? eq(eventBenefitRedemptions.registrationId, registration.id)
      : eq(eventBenefitRedemptions.attendeeId, attendee.id);
    const [existing] = await tx
      .select()
      .from(eventBenefitRedemptions)
      .where(and(eq(eventBenefitRedemptions.eventId, input.eventId), eq(eventBenefitRedemptions.status, "active"), subject))
      .limit(1);
    if (existing) return { ok: false, reason: "already_redeemed" };

    const [benefit] = await tx
      .select()
      .from(eventBenefits)
      .where(and(eq(eventBenefits.id, input.benefitId), eq(eventBenefits.eventId, input.eventId)))
      .for("update");
    if (!benefit || !benefit.active) return { ok: false, reason: "inactive_benefit" };
    if (benefit.quantity !== null) {
      const [stock] = await tx
        .select({ count: count() })
        .from(eventBenefitRedemptions)
        .where(and(eq(eventBenefitRedemptions.benefitId, benefit.id), eq(eventBenefitRedemptions.status, "active")));
      if (Number(stock?.count ?? 0) >= benefit.quantity) return { ok: false, reason: "stock_exhausted" };
    }

    const [redemption] = await tx
      .insert(eventBenefitRedemptions)
      .values({
        eventId: input.eventId,
        benefitId: benefit.id,
        scope: event.benefitRedemptionScope,
        attendeeId: attendee.id,
        registrationId: registration.id,
        actorId: input.actorId,
      })
      .returning();
    if (!event.benefitRedemptionStartedAt) {
      await tx
        .update(events)
        .set({ benefitRedemptionStartedAt: new Date() })
        .where(and(eq(events.id, input.eventId), isNull(events.benefitRedemptionStartedAt)))
        .returning();
    }
    return { ok: true, redemption };
  });
}

export type AnnulBenefitResult =
  | { ok: true; redemption: BenefitRedemptionRow }
  | { ok: false; reason: "not_found" | "already_annulled" | "annulment_reason_required" };

export async function annulBenefitRedemption(input: { eventId: string; redemptionId: string; actorId: string; reason: string }): Promise<AnnulBenefitResult> {
  const reason = input.reason.trim();
  if (!reason) return { ok: false, reason: "annulment_reason_required" };
  return db.transaction(async (tx) => {
    const [redemption] = await tx
      .select()
      .from(eventBenefitRedemptions)
      .where(and(eq(eventBenefitRedemptions.id, input.redemptionId), eq(eventBenefitRedemptions.eventId, input.eventId)))
      .for("update");
    if (!redemption) return { ok: false, reason: "not_found" };
    if (redemption.eventId !== input.eventId) return { ok: false, reason: "not_found" };
    if (redemption.status === "annulled") return { ok: false, reason: "already_annulled" };
    const [updated] = await tx
      .update(eventBenefitRedemptions)
      .set({ status: "annulled", annulledAt: new Date(), annulledBy: input.actorId, annulmentReason: reason })
      .where(and(eq(eventBenefitRedemptions.id, input.redemptionId), eq(eventBenefitRedemptions.eventId, input.eventId), eq(eventBenefitRedemptions.status, "active")))
      .returning();
    return updated ? { ok: true, redemption: updated } : { ok: false, reason: "not_found" };
  });
}

export type EventMutationResult =
  | { ok: true; event: EventRow }
  | { ok: false; reason: "forbidden" | "not_found" };

export type DeleteEventResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "not_found" | "has_registrations" };

export type CreateEventInput = {
  organizationId: string;
  // Caller-supplied, not re-derived here (spec.md "ADMIN-Only Event Authoring") — the events
  // module never imports auth/session machinery itself, it only gates on the role the caller
  // already resolved via `@/modules/users`/`@/modules/auth`.
  actorRole: UserRole;
  name: string;
  slug: string;
  description?: string;
  location?: string;
  locationUrl?: string | null;
  startsAt: Date;
  endsAt?: Date;
  capacity?: number | null;
  reminderOffsetMinutes?: number | null;
  checkInConfirmationRequired?: boolean;
  // spec.md "Fixed Optional Field Catalog" — omitted on create means the schema default (false).
  collectCompany?: boolean;
  collectJobTitle?: boolean;
  // Landing content model — omitted on create means the schema default (null / empty array).
  heroImageUrl?: string | null;
  agenda?: AgendaItem[];
  sponsorLogos?: SponsorLogo[];
  registrationFormConfig?: EventRow["registrationFormConfig"];
  emailContent?: EventEmailContent | null;
  telegramChatId?: string | null;
};

// spec.md "ADMIN-Only Event Authoring": only ADMIN may create, edit, publish, or close events;
// any other role is denied and no change is persisted.
export async function createEvent(input: CreateEventInput): Promise<EventMutationResult> {
  if (!isAdmin({ role: input.actorRole })) return { ok: false, reason: "forbidden" };

  const [event] = await db
    .insert(events)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      location: input.location,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      reminderOffsetMinutes: input.reminderOffsetMinutes ?? DEFAULT_EVENT_REMINDER_OFFSET_MINUTES,
      locationUrl: input.locationUrl,
      checkInConfirmationRequired: input.checkInConfirmationRequired,
      collectCompany: input.collectCompany,
      collectJobTitle: input.collectJobTitle,
      heroImageUrl: input.heroImageUrl,
      agenda: input.agenda,
      sponsorLogos: input.sponsorLogos,
      emailContent: input.emailContent,
    })
    .returning();
  return { ok: true, event };
}

export type UpdateEventChanges = Partial<{
  name: string;
  description: string | null;
  location: string | null;
  locationUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  reminderOffsetMinutes: number | null;
  checkInConfirmationRequired: boolean;
  collectCompany: boolean;
  collectJobTitle: boolean;
  heroImageUrl: string | null;
  agenda: AgendaItem[];
  sponsorLogos: SponsorLogo[];
  registrationFormConfig: EventRow["registrationFormConfig"];
  emailContent: EventEmailContent | null;
  telegramChatId: string | null;
  telegramMessageTemplate: string | null;
}>;

export async function updateEvent(input: {
  id: string;
  organizationId: string;
  actorId?: string;
  actorRole: UserRole;
  changes: UpdateEventChanges;
}): Promise<EventMutationResult> {
  if (!(await canEditEvent(input))) return { ok: false, reason: "forbidden" };

  const [event] = await db
    .update(events)
    .set(input.changes)
    .where(and(eq(events.id, input.id), eq(events.organizationId, input.organizationId)))
    .returning();
  if (!event) return { ok: false, reason: "not_found" };
  return { ok: true, event };
}

// spec.md "Event Lifecycle Status": status moves draft -> published -> closed; only ADMIN may
// drive the transition.
export async function setEventStatus(input: {
  id: string;
  organizationId: string;
  actorRole: UserRole;
  status: "published" | "closed";
}): Promise<EventMutationResult> {
  if (!isAdmin({ role: input.actorRole })) return { ok: false, reason: "forbidden" };

  const [event] = await db
    .update(events)
    .set({ status: input.status })
    .where(and(eq(events.id, input.id), eq(events.organizationId, input.organizationId)))
    .returning();
  if (!event) return { ok: false, reason: "not_found" };
  return { ok: true, event };
}

export async function archiveEvent(input: {
  id: string;
  organizationId: string;
  actorRole: UserRole;
}): Promise<EventMutationResult> {
  if (!isAdmin({ role: input.actorRole })) return { ok: false, reason: "forbidden" };
  const [event] = await db
    .update(events)
    .set({ status: "archived" })
    .where(and(eq(events.id, input.id), eq(events.organizationId, input.organizationId)))
    .returning();
  return event ? { ok: true, event } : { ok: false, reason: "not_found" };
}

export async function restoreEvent(input: {
  id: string;
  organizationId: string;
  actorRole: UserRole;
}): Promise<EventMutationResult> {
  if (!isAdmin({ role: input.actorRole })) return { ok: false, reason: "forbidden" };
  const [event] = await db
    .update(events)
    .set({ status: "published" })
    .where(and(eq(events.id, input.id), eq(events.organizationId, input.organizationId), eq(events.status, "archived")))
    .returning();
  return event ? { ok: true, event } : { ok: false, reason: "not_found" };
}

export async function deleteEvent(input: {
  id: string;
  organizationId: string;
  actorRole: UserRole;
}): Promise<DeleteEventResult> {
  if (!isAdmin({ role: input.actorRole })) return { ok: false, reason: "forbidden" };
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, input.id), eq(events.organizationId, input.organizationId)))
    .limit(1);
  if (!event) return { ok: false, reason: "not_found" };

  const [registrationCount] = await db
    .select({ count: count() })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, input.id));
  if (Number(registrationCount?.count ?? 0) > 0) return { ok: false, reason: "has_registrations" };

  await db.delete(events).where(eq(events.id, input.id));
  return { ok: true };
}

export async function listEvents(
  organizationId: string,
  options: { includeArchived?: boolean } = {},
): Promise<EventRow[]> {
  return db
    .select()
    .from(events)
    .where(
      options.includeArchived
        ? eq(events.organizationId, organizationId)
        : and(eq(events.organizationId, organizationId), ne(events.status, "archived")),
    )
    .orderBy(desc(events.createdAt));
}

export async function listAccessibleEvents(input: {
  organizationId: string;
  userId: string;
  role: UserRole;
  includeArchived?: boolean;
}): Promise<EventRow[]> {
  if (isAdmin({ role: input.role })) {
    return listEvents(input.organizationId, { includeArchived: input.includeArchived });
  }
  if (input.role !== "EVENT_EDITOR" && input.role !== "RECEPTION") return [];

  const assignments = input.role === "EVENT_EDITOR" ? eventEditors : eventReceptionists;

  const rows = await db
    .select({ event: events })
    .from(events)
    .innerJoin(assignments, eq(assignments.eventId, events.id))
    .where(
      input.includeArchived
        ? and(eq(events.organizationId, input.organizationId), eq(assignments.userId, input.userId))
        : and(
            eq(events.organizationId, input.organizationId),
            eq(assignments.userId, input.userId),
            ne(events.status, "archived"),
          ),
    )
    .orderBy(desc(events.createdAt));
  return rows.map(({ event }) => event);
}

export async function getEvent(id: string, organizationId: string): Promise<EventRow | undefined> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.organizationId, organizationId)))
    .limit(1);
  return rows[0];
}

// spec.md "Event Lifecycle Status": draft events MUST NOT render on the public landing route —
// this is the only read path that route can use, so a draft never has a row to return. Scoped by
// organizationId like every other read in this module (verify-report W4): without it, a slug
// collision across organizations would leak a cross-tenant read once PR3 wires this into a public
// route. Test-pinned (verify-report C3): service.test.ts asserts the exact `and(eq(...))` WHERE
// predicate object, so deleting the status or organization clause fails that test.
export async function getPublishedEventBySlug(
  slug: string,
  organizationId: string,
): Promise<EventRow | undefined> {
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.slug, slug),
        eq(events.status, "published"),
        eq(events.organizationId, organizationId),
      ),
    )
    .limit(1);
  return rows[0];
}

// spec.md "Public Landing Content Sections": the public route does not know `organizationId`
// ahead of time (there is no session) — same shape as
// `src/modules/links/service.ts#resolveShortLinkByHostAndSlug`, which resolves a public route by
// slug alone and lets the resolved row carry its own `organizationId` forward. Draft events still
// return `undefined` here (status filter), matching the "draft 404" scenario.
export async function getPublishedEventBySlugPublic(slug: string): Promise<EventRow | undefined> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.status, "published")))
    .limit(1);
  return rows[0];
}

export type EventRegistrationRow = typeof eventRegistrations.$inferSelect;
export type EventAttendeeRow = typeof eventAttendees.$inferSelect;

export type AttendeeInput = {
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  occupation?: string;
  state?: string;
};

export type UtmFields = Partial<{
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  utmId: string;
}>;

export type RegisterForEventInput = {
  eventId: string;
  // spec.md "Manual Admin-Added Registrations" — identical flow either way, only `source` differs.
  source?: "public" | "admin_added";
  primary: AttendeeInput;
  companions?: AttendeeInput[];
  clientBrands?: string[];
  interests?: string[];
  requestedMoreCompanions?: boolean;
  consents?: {
    privacyAcceptedAt: Date;
    termsAcceptedAt: Date;
    marketingAcceptedAt?: Date;
  };
  formVersion?: number;
  customFormAnswers?: RegistrationFormAnswers;
  utm?: UtmFields;
};

export type RegisterForEventResult =
  | { ok: true; registration: EventRegistrationRow; attendees: EventAttendeeRow[] }
  | { ok: false; reason: "event_not_found" | "duplicate_email" };

// Postgres unique_violation (porsager/postgres attaches `code`/`constraint_name` to the thrown
// error). Only the per-event active-email index maps to the spec's "duplicate registration"
// domain error (spec.md "Per-Event Email Uniqueness"); any other unique violation (e.g. a
// backup-code collision, astronomically rare at 32^8 combinations) is a real defect and is
// re-thrown rather than silently mislabeled.
// drizzle-orm's postgres-js driver wraps the raw Postgres error in its own `DrizzleQueryError`
// (observed live: a real duplicate registration crashed the page instead of showing the friendly
// message, because this check read `error.code` directly — but `code`/`constraint_name` live on
// `error.cause`, not the wrapper itself). Check `error.cause` first since that's what actually
// ships today; fall back to `error` itself so a future driver version that stops wrapping (or any
// other caller that throws the bare pg error) still matches.
function isDuplicateEmailViolation(error: unknown): boolean {
  const wrapper = error as { cause?: unknown } | undefined;
  const pgError = (wrapper?.cause ?? error) as { code?: string; constraint_name?: string } | undefined;
  return (
    pgError?.code === "23505" &&
    pgError?.constraint_name === "event_attendees_event_email_active_unique"
  );
}

// design.md "Waitlist concurrency": locks the `events` row (not `event_registrations`, which may
// have zero rows for a brand-new event and would therefore acquire no lock) so every capacity
// decision for this event — registration or cancellation — serializes through the same row lock,
// same FOR UPDATE precedent as `src/modules/users/management.ts#mutateManagedUser`.
async function lockEventForCapacityDecision(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  eventId: string,
) {
  await tx.execute(sql`select id from events where id = ${eventId} for update`);
}

async function countConfirmedSeats(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  eventId: string,
): Promise<number> {
  const [row] = await tx
    .select({ seatsUsed: count() })
    .from(eventAttendees)
    .innerJoin(eventRegistrations, eq(eventAttendees.registrationId, eventRegistrations.id))
    .where(
      and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.isActive, true),
        eq(eventRegistrations.status, "confirmed"),
      ),
    );
  return row?.seatsUsed ?? 0;
}

// spec.md "Registration With Companions" + "Capacity Enforcement and Waitlist Placement" +
// "Concurrency-Safe Waitlist Promotion" (the creation half). The whole registration group
// (primary + companions) shares one status: either every seat fits under capacity (`confirmed`)
// or none do (`waitlisted`) — there is no partial allocation within a single submission.
// Email dispatch is NOT performed here: callers (app/events/[slug]/actions.ts) send
// `sendConfirmationEmail` per attendee AFTER this resolves, matching design.md "Emails sent AFTER
// commit, never inside the lock."
export async function registerForEvent(input: RegisterForEventInput): Promise<RegisterForEventResult> {
  const attendeeInputs = [input.primary, ...(input.companions ?? [])];
  const source = input.source ?? "public";

  try {
    return await db.transaction(async (tx) => {
      await lockEventForCapacityDecision(tx, input.eventId);

      const [event] = await tx.select().from(events).where(eq(events.id, input.eventId)).limit(1);
      if (!event) return { ok: false, reason: "event_not_found" };
      if (source === "public" && event.status !== "published") {
        return { ok: false, reason: "event_not_found" };
      }

      let status: "pending_review" | "confirmed" | "waitlisted" = source === "public" ? "pending_review" : "confirmed";
      if (source === "admin_added" && event.capacity !== null) {
        const seatsUsed = await countConfirmedSeats(tx, input.eventId);
        if (seatsUsed + attendeeInputs.length > event.capacity) status = "waitlisted";
      }

      const [registration] = await tx
        .insert(eventRegistrations)
        .values({
          organizationId: event.organizationId,
          eventId: input.eventId,
          status,
          source,
          cancelToken: generateOpaqueToken(),
          utmSource: input.utm?.utmSource,
          utmMedium: input.utm?.utmMedium,
          utmCampaign: input.utm?.utmCampaign,
          utmTerm: input.utm?.utmTerm,
          utmContent: input.utm?.utmContent,
          utmId: input.utm?.utmId,
          clientBrands: input.clientBrands ?? [],
          interests: input.interests ?? [],
          formVersion: input.formVersion ?? 1,
          customFormAnswers: input.customFormAnswers ?? {},
          requestedMoreCompanions: input.requestedMoreCompanions ?? false,
          consents: input.consents
            ? ({
                privacyAcceptedAt: input.consents.privacyAcceptedAt.toISOString(),
                termsAcceptedAt: input.consents.termsAcceptedAt.toISOString(),
                ...(input.consents.marketingAcceptedAt
                  ? { marketingAcceptedAt: input.consents.marketingAcceptedAt.toISOString() }
                  : {}),
              } satisfies RegistrationConsents)
            : null,
        })
        .returning();

      const attendees: EventAttendeeRow[] = [];
      for (const attendee of attendeeInputs) {
        const [row] = await tx
          .insert(eventAttendees)
          .values({
            organizationId: event.organizationId,
            eventId: input.eventId,
            registrationId: registration.id,
            fullName: attendee.fullName,
            email: attendee.email,
            emailNormalized: normalizeEmail(attendee.email),
            phone: attendee.phone,
            company: attendee.company,
            jobTitle: attendee.jobTitle,
            occupation: attendee.occupation,
            state: attendee.state,
            passToken: generateOpaqueToken(),
            backupCode: generateBackupCode(),
            isActive: true,
          })
          .returning();
        attendees.push(row);
      }

      return { ok: true, registration, attendees };
    });
  } catch (error) {
    if (isDuplicateEmailViolation(error)) return { ok: false, reason: "duplicate_email" };
    throw error;
  }
}

export type AddAttendeeToRegistrationInput = {
  registrationId: string;
  organizationId: string;
  ignoreCapacity?: boolean;
  attendee: AttendeeInput;
};

export type AddAttendeeToRegistrationResult =
  | { ok: true; attendee: EventAttendeeRow; registrationStatus: "confirmed" | "waitlisted"; cancelToken: string }
  | { ok: false; reason: "registration_not_found" | "cancelled" | "at_capacity" | "duplicate_email" };

// Admin feedback round: a "master form" to add more companions to a registration AFTER it was
// already submitted. The new attendee joins the registration's EXISTING status (design.md "whole
// registration group shares one status" stays true — this never splits a confirmed registration
// into mixed confirmed/waitlisted attendees); a confirmed registration that's now at capacity is
// rejected outright (`at_capacity`) rather than silently waitlisting just the new person alone. A
// waitlisted registration skips the capacity check entirely — it isn't holding a seat either way.
export async function addAttendeeToRegistration(
  input: AddAttendeeToRegistrationInput,
): Promise<AddAttendeeToRegistrationResult> {
  try {
    return await db.transaction(async (tx) => {
      const [registration] = await tx
        .select()
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.id, input.registrationId),
            eq(eventRegistrations.organizationId, input.organizationId),
          ),
        )
        .limit(1);
      if (!registration) return { ok: false, reason: "registration_not_found" };
      if (registration.status === "cancelled") return { ok: false, reason: "cancelled" };

      await lockEventForCapacityDecision(tx, registration.eventId);

      const [event] = await tx.select().from(events).where(eq(events.id, registration.eventId)).limit(1);
      if (!event) return { ok: false, reason: "registration_not_found" };

      if (!input.ignoreCapacity && registration.status !== "waitlisted" && event.capacity !== null) {
        const seatsUsed = await countConfirmedSeats(tx, registration.eventId);
        if (seatsUsed + 1 > event.capacity) return { ok: false, reason: "at_capacity" };
      }

      const [row] = await tx
        .insert(eventAttendees)
        .values({
          organizationId: event.organizationId,
          eventId: registration.eventId,
          registrationId: registration.id,
          fullName: input.attendee.fullName,
          email: input.attendee.email,
          emailNormalized: normalizeEmail(input.attendee.email),
          phone: input.attendee.phone,
           company: input.attendee.company,
           jobTitle: input.attendee.jobTitle,
           occupation: input.attendee.occupation,
          passToken: generateOpaqueToken(),
          backupCode: generateBackupCode(),
          isActive: true,
        })
        .returning();

      return {
        ok: true,
        attendee: row,
        registrationStatus: registration.status === "waitlisted" ? "waitlisted" : "confirmed",
        cancelToken: registration.cancelToken,
      };
    });
  } catch (error) {
    if (isDuplicateEmailViolation(error)) return { ok: false, reason: "duplicate_email" };
    throw error;
  }
}

export type CancelRegistrationResult =
  | { ok: true; registration: EventRegistrationRow; promoted?: { registration: EventRegistrationRow; attendees: EventAttendeeRow[] } }
  | { ok: false; reason: "invalid_token" | "already_cancelled" };

// spec.md "Registrant self-cancels via signed link" + "Concurrency-Safe Waitlist Promotion" (the
// cancellation half). `cancelToken` alone is the authorization — opaque/unguessable, so token
// possession IS the authorization (design.md "Pass + cancel tokens"); there is no login and no
// other identifier required, and a token can only ever affect the one registration it was minted
// for (spec.md "Registrant cannot self-edit" / "token A cannot cancel B").
export async function cancelRegistrationByToken(
  cancelToken: string,
): Promise<CancelRegistrationResult> {
  return db.transaction(async (tx) => {
    const [registration] = await tx
      .select()
      .from(eventRegistrations)
      .where(eq(eventRegistrations.cancelToken, cancelToken))
      .limit(1);
    if (!registration) return { ok: false, reason: "invalid_token" };
    if (registration.status === "cancelled") return { ok: false, reason: "already_cancelled" };

    // Same per-event lock as registration (design.md "Waitlist concurrency") — serializes this
    // cancellation against concurrent registrations/cancellations on the same event.
    await lockEventForCapacityDecision(tx, registration.eventId);

    const [cancelled] = await tx
      .update(eventRegistrations)
      .set({ status: "cancelled" })
      .where(eq(eventRegistrations.id, registration.id))
      .returning();
    await tx
      .update(eventAttendees)
      .set({ isActive: false })
      .where(eq(eventAttendees.registrationId, registration.id));

    // Only a freed CONFIRMED seat can promote someone — cancelling an already-waitlisted
    // registration frees no seat.
    if (registration.status !== "confirmed") {
      return { ok: true, registration: cancelled };
    }

    const [oldestWaitlisted] = await tx
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, registration.eventId),
          eq(eventRegistrations.status, "waitlisted"),
        ),
      )
      .orderBy(asc(eventRegistrations.createdAt))
      .limit(1);
    if (!oldestWaitlisted) return { ok: true, registration: cancelled };

    const [promotedRegistration] = await tx
      .update(eventRegistrations)
      .set({ status: "confirmed" })
      .where(eq(eventRegistrations.id, oldestWaitlisted.id))
      .returning();
    const promotedAttendees = await tx
      .select()
      .from(eventAttendees)
      .where(eq(eventAttendees.registrationId, oldestWaitlisted.id));

    return {
      ok: true,
      registration: cancelled,
      promoted: { registration: promotedRegistration, attendees: promotedAttendees },
    };
  });
}

// Read-only lookup for the self-cancel link landing page (tasks.md 3.10/3.11) — does NOT cancel.
// Letting the page render the registration's current status before any mutation means visiting
// the link again after cancelling (or a prefetcher following it) shows the already-cancelled
// state instead of silently no-op'ing; the actual cancellation stays a deliberate POST through
// cancelRegistrationByToken.
export async function getRegistrationByCancelToken(
  cancelToken: string,
): Promise<EventRegistrationRow | undefined> {
  const rows = await db
    .select()
    .from(eventRegistrations)
    .where(eq(eventRegistrations.cancelToken, cancelToken))
    .limit(1);
  return rows[0];
}

export type CheckInInput = {
  eventId: string;
  passToken?: string;
  backupCode?: string;
  checkedInBy: string;
};

export type CheckInResult =
  | { ok: true; attendee: EventAttendeeRow; alreadyCheckedIn: boolean }
  | { ok: false; reason: "not_found" };

export type CheckInLookupResult =
  | { kind: "not_found" }
  | { kind: "already_checked_in" | "eligible" | "blocked"; attendee: EventAttendeeRow; registration: RegistrationWithAttendees; reason?: "cancelled" | "waitlisted" };

export async function lookupAttendeeForCheckIn(input: { eventId: string; code: string }): Promise<CheckInLookupResult> {
  const code = input.code.trim();
  if (!code) return { kind: "not_found" };

  const [attendee] = await db
    .select()
    .from(eventAttendees)
    .where(
      and(
        eq(eventAttendees.eventId, input.eventId),
        or(eq(eventAttendees.backupCode, code.toUpperCase()), eq(eventAttendees.passToken, code)),
      ),
    )
    .limit(1);
  if (!attendee) return { kind: "not_found" };

  const [registration] = await db
    .select()
    .from(eventRegistrations)
    .where(and(eq(eventRegistrations.id, attendee.registrationId), eq(eventRegistrations.eventId, input.eventId)))
    .limit(1);
  if (!registration) return { kind: "not_found" };

  const attendees = await db.select().from(eventAttendees).where(eq(eventAttendees.registrationId, registration.id));
  const registrationWithAttendees = { ...registration, attendees };
  const kind: CheckInResultKind = getCheckInResultKind({ registrationStatus: registration.status, checkedInAt: attendee.checkedInAt });
  if (kind === "blocked") return { kind, attendee, registration: registrationWithAttendees, reason: registration.status as "cancelled" | "waitlisted" };
  return { kind, attendee, registration: registrationWithAttendees };
}

export type UpdatePrimaryAttendeeResult =
  | { ok: true; attendee: EventAttendeeRow }
  | { ok: false; reason: "not_found" | "duplicate_email" };

export async function updatePrimaryAttendee(input: {
  registrationId: string;
  organizationId: string;
  attendee: Partial<Pick<AttendeeInput, "fullName" | "email" | "phone" | "company" | "jobTitle" | "occupation">>;
}): Promise<UpdatePrimaryAttendeeResult> {
  const [primary] = await db
    .select({ id: eventAttendees.id })
    .from(eventAttendees)
    .innerJoin(eventRegistrations, eq(eventRegistrations.id, eventAttendees.registrationId))
    .where(and(eq(eventAttendees.registrationId, input.registrationId), eq(eventRegistrations.organizationId, input.organizationId)))
    .orderBy(asc(eventAttendees.createdAt))
    .limit(1);
  if (!primary) return { ok: false, reason: "not_found" };

  try {
    const [updated] = await db
      .update(eventAttendees)
      .set({
        fullName: input.attendee.fullName,
        email: input.attendee.email,
        emailNormalized: input.attendee.email ? normalizeEmail(input.attendee.email) : undefined,
        phone: input.attendee.phone,
        company: input.attendee.company,
        jobTitle: input.attendee.jobTitle,
        occupation: input.attendee.occupation,
        updatedAt: new Date(),
      })
      .where(eq(eventAttendees.id, primary.id))
      .returning();
    return updated ? { ok: true, attendee: updated } : { ok: false, reason: "not_found" };
  } catch (error) {
    if (isDuplicateEmailViolation(error)) return { ok: false, reason: "duplicate_email" };
    throw error;
  }
}

export async function confirmAttendeeCheckIn(input: { eventId: string; attendeeId: string; checkedInBy: string }): Promise<CheckInResult> {
  const [updated] = await db
    .update(eventAttendees)
    .set({ checkedInAt: new Date(), checkedInBy: input.checkedInBy })
    .where(and(eq(eventAttendees.id, input.attendeeId), eq(eventAttendees.eventId, input.eventId), isNull(eventAttendees.checkedInAt)))
    .returning();
  if (!updated) {
    const [existing] = await db.select().from(eventAttendees).where(and(eq(eventAttendees.id, input.attendeeId), eq(eventAttendees.eventId, input.eventId))).limit(1);
    return existing ? { ok: true, attendee: existing, alreadyCheckedIn: true } : { ok: false, reason: "not_found" };
  }
  await db.update(eventRegistrations).set({ status: "checked_in" }).where(eq(eventRegistrations.id, updated.registrationId));
  return { ok: true, attendee: updated, alreadyCheckedIn: false };
}

// spec.md "Individual Attendee Passes" / "Backup Code Manual Check-In" / "Duplicate Check-In
// Prevention". Both lookups are scoped to `eventId` — the staff member checking people in is
// always doing so for one specific event (design.md's check-in route is per-event), and
// `backupCode` is only unique WITHIN an event (db.ts `event_attendees_event_backup_code_unique`),
// never globally. A re-scan of an already-checked-in attendee returns the prior timestamp as-is
// and performs no update at all — idempotent by construction, not by a second write that happens
// to set the same value.
export async function checkInAttendee(input: CheckInInput): Promise<CheckInResult> {
  if (!input.passToken && !input.backupCode) return { ok: false, reason: "not_found" };

  const condition = input.passToken
    ? and(eq(eventAttendees.eventId, input.eventId), eq(eventAttendees.passToken, input.passToken))
    : and(eq(eventAttendees.eventId, input.eventId), eq(eventAttendees.backupCode, input.backupCode!));

  const [attendee] = await db.select().from(eventAttendees).where(condition).limit(1);
  if (!attendee) return { ok: false, reason: "not_found" };
  if (attendee.checkedInAt) return { ok: true, attendee, alreadyCheckedIn: true };

  const [updated] = await db
    .update(eventAttendees)
    .set({ checkedInAt: new Date(), checkedInBy: input.checkedInBy })
    .where(eq(eventAttendees.id, attendee.id))
    .returning();

  // design.md "per-attendee checked_in_at remains authoritative; registration flips to
  // checked_in on first attendee check-in" — unconditional on every (necessarily first, since
  // this branch only runs once per attendee) successful check-in.
  await db
    .update(eventRegistrations)
    .set({ status: "checked_in" })
    .where(eq(eventRegistrations.id, attendee.registrationId))
    .returning();

  return { ok: true, attendee: updated, alreadyCheckedIn: false };
}

// design.md "Testing Strategy" lists "reminder-due arithmetic" as its own unit — kept pure and
// separate from the query below so the window logic needs no real clock or SQL interval
// arithmetic to test. Due from the moment `reminderOffsetMinutes` before `startsAt` is reached,
// until the event actually starts (never reminds about an event already underway).
export function isReminderDue(now: Date, startsAt: Date, reminderOffsetMinutes: number): boolean {
  const reminderOpensAt = startsAt.getTime() - reminderOffsetMinutes * 60_000;
  return now.getTime() >= reminderOpensAt && now.getTime() < startsAt.getTime();
}

export type DueReminderAttendee = { event: EventRow; attendee: EventAttendeeRow; cancelToken: string };

// spec.md "Webhook-Driven Reminder Trigger" — one query joining confirmed/active attendees of
// published events to their event, then filtering by `isReminderDue` in application code rather
// than a raw SQL interval predicate (keeps the due-window logic in the one place it's unit
// tested). Exactly-once delivery per attendee is NOT this function's job — it just lists who is
// currently due; `sendReminderEmail`'s `claimNotification` call is the idempotency boundary, safe
// to call every time this list includes the same attendee across repeated webhook invocations.
export async function listDueReminderAttendees(now: Date = new Date()): Promise<DueReminderAttendee[]> {
  const rows = await db
    .select({ event: events, attendee: eventAttendees, cancelToken: eventRegistrations.cancelToken })
    .from(eventAttendees)
    .innerJoin(eventRegistrations, eq(eventAttendees.registrationId, eventRegistrations.id))
    .innerJoin(events, eq(eventAttendees.eventId, events.id))
    .where(
      and(
        eq(eventAttendees.isActive, true),
        eq(eventRegistrations.status, "confirmed"),
        eq(events.status, "published"),
      ),
    );

  return rows.filter(
    ({ event }) => event.reminderOffsetMinutes !== null && isReminderDue(now, event.startsAt, event.reminderOffsetMinutes),
  );
}

// design.md "Open Questions" (resolved in PR5) — a plain atomic increment on `events.visit_count`
// for the dashboard's "visits" number, never a write into `tracking_events` (analytics' own
// link/QR click-tracking table; this module stays a leaf consumer of @/modules/analytics'
// public index, not a writer to its tables). Scoped to `status = 'published'` so a draft/closed
// event's stray view (or a crawler hitting a stale link) never inflates a number ADMIN sees.
// Deliberately fire-and-forget from the caller's perspective: this function itself still awaits
// the write, but a caller renders the page regardless of whether this resolves or rejects.
export async function recordEventVisit(slug: string): Promise<void> {
  await db
    .update(events)
    .set({ visitCount: sql`${events.visitCount} + 1` })
    .where(and(eq(events.slug, slug), eq(events.status, "published")));
}

export type RegistrationWithAttendees = EventRegistrationRow & { attendees: EventAttendeeRow[] };

export async function listEventReceptionistIds(eventId: string, organizationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: eventReceptionists.userId })
    .from(eventReceptionists)
    .innerJoin(events, eq(events.id, eventReceptionists.eventId))
    .where(and(eq(eventReceptionists.eventId, eventId), eq(events.organizationId, organizationId)));
  return rows.map((row) => row.userId);
}

export async function listEventEditorIds(eventId: string, organizationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: eventEditors.userId })
    .from(eventEditors)
    .innerJoin(events, eq(events.id, eventEditors.eventId))
    .where(and(eq(eventEditors.eventId, eventId), eq(events.organizationId, organizationId)));
  return rows.map((row) => row.userId);
}

export type RegistrationReviewUpdateResult = EventRegistrationRow | { reason: "capacity" } | undefined;

export async function updateRegistrationReviewStatus(input: {
  registrationId: string;
  eventId: string;
  organizationId: string;
  reviewStatus: EventRegistrationRow["reviewStatus"];
  reviewedBy: string;
}): Promise<RegistrationReviewUpdateResult> {
  return db.transaction(async (tx) => {
    const [registration] = await tx
      .select()
      .from(eventRegistrations)
      .where(and(
        eq(eventRegistrations.id, input.registrationId),
        eq(eventRegistrations.eventId, input.eventId),
        eq(eventRegistrations.organizationId, input.organizationId),
      ))
      .limit(1);
    if (!registration) return undefined;

    await lockEventForCapacityDecision(tx, input.eventId);
    const now = new Date();
    const status = input.reviewStatus === "approved"
      ? "confirmed"
      : input.reviewStatus === "waitlisted"
        ? "waitlisted"
        : input.reviewStatus === "rejected"
          ? "rejected"
          : registration.status;

    if (input.reviewStatus === "approved") {
      const [event] = await tx.select().from(events).where(eq(events.id, input.eventId)).limit(1);
      if (!event) return undefined;
      const seatsUsed = await countConfirmedSeats(tx, input.eventId);
      const requestedSeats = await tx
        .select({ seats: count() })
        .from(eventAttendees)
        .where(and(eq(eventAttendees.registrationId, input.registrationId), eq(eventAttendees.isActive, true)));
      if (event.capacity !== null && seatsUsed + Number(requestedSeats[0]?.seats ?? 0) > event.capacity) {
        return { reason: "capacity" };
      }
    }

    const [updated] = await tx
      .update(eventRegistrations)
      .set({ status, reviewStatus: input.reviewStatus, reviewedBy: input.reviewedBy, reviewedAt: now, updatedAt: now })
      .where(eq(eventRegistrations.id, input.registrationId))
      .returning();
    return updated;
  });
}

export async function deleteRejectedRegistration(input: {
  registrationId: string;
  eventId: string;
  organizationId: string;
}): Promise<EventRegistrationRow | undefined> {
  return db.transaction(async (tx) => {
    const [registration] = await tx
      .select()
      .from(eventRegistrations)
      .where(and(
        eq(eventRegistrations.id, input.registrationId),
        eq(eventRegistrations.eventId, input.eventId),
        eq(eventRegistrations.organizationId, input.organizationId),
      ))
      .limit(1);
    if (!registration || registration.status !== "rejected") return undefined;

    await tx.delete(eventAttendees).where(eq(eventAttendees.registrationId, registration.id));
    const [deleted] = await tx
      .delete(eventRegistrations)
      .where(and(
        eq(eventRegistrations.id, registration.id),
        eq(eventRegistrations.eventId, input.eventId),
        eq(eventRegistrations.organizationId, input.organizationId),
      ))
      .returning();
    return deleted;
  });
}

export async function assignEventReceptionist(eventId: string, userId: string, organizationId: string): Promise<boolean> {
  const event = await getEvent(eventId, organizationId);
  if (!event) return false;
  await db.insert(eventReceptionists).values({ eventId, userId }).onConflictDoNothing();
  return true;
}

export async function removeEventReceptionist(eventId: string, userId: string, organizationId: string): Promise<boolean> {
  const event = await getEvent(eventId, organizationId);
  if (!event) return false;
  await db
    .delete(eventReceptionists)
    .where(and(eq(eventReceptionists.eventId, eventId), eq(eventReceptionists.userId, userId)));
  return true;
}

export async function assignEventEditor(eventId: string, userId: string, organizationId: string): Promise<boolean> {
  const event = await getEvent(eventId, organizationId);
  if (!event) return false;
  await db.insert(eventEditors).values({ eventId, userId }).onConflictDoNothing();
  return true;
}

export async function removeEventEditor(eventId: string, userId: string, organizationId: string): Promise<boolean> {
  const event = await getEvent(eventId, organizationId);
  if (!event) return false;
  await db
    .delete(eventEditors)
    .where(and(eq(eventEditors.eventId, eventId), eq(eventEditors.userId, userId)));
  return true;
}

async function canEditEvent(input: {
  id: string;
  organizationId: string;
  actorId?: string;
  actorRole: UserRole;
}): Promise<boolean> {
  if (isAdmin({ role: input.actorRole })) return true;
  if (input.actorRole !== "EVENT_EDITOR" || !input.actorId) return false;
  const [assignment] = await db
    .select({ userId: eventEditors.userId })
    .from(eventEditors)
    .innerJoin(events, eq(events.id, eventEditors.eventId))
    .where(
      and(
        eq(eventEditors.eventId, input.id),
        eq(eventEditors.userId, input.actorId),
        eq(events.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  return Boolean(assignment);
}

// spec.md "Registrations Admin Search and Filter" — scoped to one event+organization, with an
// optional status filter; each registration carries its own attendees (companions/contact/pass
// status) joined back on, one extra query rather than N+1 per registration.
export async function listRegistrations(
  eventId: string,
  organizationId: string,
  filter?: { status?: EventRegistrationRow["status"]; reviewStatus?: EventRegistrationRow["reviewStatus"]; q?: string },
): Promise<RegistrationWithAttendees[]> {
  const statusRequiresAttendees = filter?.status === "confirmed" || filter?.status === "checked_in";
  const predicates = [eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.organizationId, organizationId)];
  if (filter?.status && !statusRequiresAttendees) predicates.push(eq(eventRegistrations.status, filter.status));
  if (filter?.reviewStatus) predicates.push(eq(eventRegistrations.reviewStatus, filter.reviewStatus));
  const scope = and(...predicates);

  const registrations = await db
    .select()
    .from(eventRegistrations)
    .where(scope)
    .orderBy(desc(eventRegistrations.createdAt));
  if (registrations.length === 0) return [];

  const registrationIds = registrations.map((registration) => registration.id);
  const attendees = await db
    .select()
    .from(eventAttendees)
    .where(inArray(eventAttendees.registrationId, registrationIds));

  const attendeesByRegistration = new Map<string, EventAttendeeRow[]>();
  for (const attendee of attendees) {
    const list = attendeesByRegistration.get(attendee.registrationId) ?? [];
    list.push(attendee);
    attendeesByRegistration.set(attendee.registrationId, list);
  }

  const withAttendees = registrations.map((registration) => ({
    ...registration,
    attendees: attendeesByRegistration.get(registration.id) ?? [],
  }));

  const statusFiltered = statusRequiresAttendees
    ? withAttendees.filter(
        (registration) => getEffectiveRegistrationStatus(registration.status, registration.attendees) === filter.status,
      )
    : withAttendees;

  // Free-text search against the already-joined attendees rather than a second DB round-trip —
  // matches the spec's "search" half of "Registrations Admin Search and Filter" without a
  // separate full-text query path for what's at most a few hundred rows per event.
  if (!filter?.q) return statusFiltered;
  const needle = filter.q.trim().toLowerCase();
  if (!needle) return statusFiltered;
  return statusFiltered.filter((registration) =>
    registration.attendees.some(
      (attendee) =>
        attendee.fullName.toLowerCase().includes(needle) || attendee.email.toLowerCase().includes(needle),
    ),
  );
}

export type EventDashboardStatus = "pending_review" | "confirmed" | "waitlisted" | "rejected" | "cancelled";

export type EventDashboardData = {
  activity: Array<{ date: string; label: string; registrations: number }>;
  statuses: Array<{ status: EventDashboardStatus; count: number }>;
  attention: {
    pendingReview: number;
    waitlisted: number;
    confirmedWithoutCheckIn: number;
    requestedCompanions: number;
  };
  recentRegistrations: Array<{
    id: string;
    createdAt: Date;
    status: EventRegistrationRow["status"];
    reviewStatus: EventRegistrationRow["reviewStatus"];
    primaryName: string;
    attendeeCount: number;
  }>;
};

const EVENT_DASHBOARD_STATUS_ORDER: EventDashboardStatus[] = [
  "pending_review",
  "confirmed",
  "waitlisted",
  "rejected",
  "cancelled",
];

function dashboardStatus(status: EventRegistrationRow["status"]): EventDashboardStatus {
  return status === "checked_in" ? "confirmed" : status;
}

export async function getEventDashboardData(
  eventId: string,
  organizationId: string,
): Promise<EventDashboardData | undefined> {
  const event = await getEvent(eventId, organizationId);
  if (!event) return undefined;

  const registrations = await listRegistrations(eventId, organizationId);
  const statusCounts = new Map<EventDashboardStatus, number>(
    EVENT_DASHBOARD_STATUS_ORDER.map((status) => [status, 0]),
  );
  const activityCounts = new Map<string, number>();
  const recentRegistrations = registrations.slice(0, 5).map((registration) => ({
    id: registration.id,
    createdAt: registration.createdAt,
    status: registration.status,
    reviewStatus: registration.reviewStatus,
    primaryName: registration.attendees[0]?.fullName ?? "Sin nombre",
    attendeeCount: registration.attendees.filter((attendee) => attendee.isActive).length,
  }));

  let pendingReview = 0;
  let waitlisted = 0;
  let confirmedWithoutCheckIn = 0;
  let requestedCompanions = 0;

  for (const registration of registrations) {
    const status = dashboardStatus(registration.status);
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    const date = registration.createdAt.toISOString().slice(0, 10);
    activityCounts.set(date, (activityCounts.get(date) ?? 0) + 1);

    if (registration.status === "pending_review") pendingReview += 1;
    if (registration.status === "waitlisted") waitlisted += 1;
    if (registration.status === "confirmed") {
      confirmedWithoutCheckIn += registration.attendees.filter(
        (attendee) => attendee.isActive && !attendee.checkedInAt,
      ).length;
    }
    if (registration.requestedMoreCompanions && registration.status !== "cancelled") requestedCompanions += 1;
  }

  const today = new Date();
  const activity = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (13 - index)));
    const dateKey = date.toISOString().slice(0, 10);
    return {
      date: dateKey,
      label: new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(date),
      registrations: activityCounts.get(dateKey) ?? 0,
    };
  });

  return {
    activity,
    statuses: EVENT_DASHBOARD_STATUS_ORDER.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    attention: { pendingReview, waitlisted, confirmedWithoutCheckIn, requestedCompanions },
    recentRegistrations,
  };
}

export type EventInsights = {
  visits: number;
  registrations: number;
  attendance: number;
  conversion: number | null;
  confirmedSeats: number;
  capacity: number | null;
};

// spec.md "ADMIN-Only Results Dashboard" — conversion mirrors
// `src/modules/campaigns/service.ts#getScanRateForShortLink`'s "null (not 0%) when there's
// nothing to divide by yet" convention, rather than reporting a misleading 0%.
export async function getEventInsights(
  eventId: string,
  organizationId: string,
): Promise<EventInsights | undefined> {
  const event = await getEvent(eventId, organizationId);
  if (!event) return undefined;

  const [[registrationsRow], [attendanceRow], [confirmedSeatsRow]] = await Promise.all([
    db
      .select({ total: count() })
      .from(eventRegistrations)
      .where(and(eq(eventRegistrations.eventId, eventId), ne(eventRegistrations.status, "cancelled"))),
    db
      .select({ total: count() })
      .from(eventAttendees)
      .where(
        and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.isActive, true),
          isNotNull(eventAttendees.checkedInAt),
        ),
      ),
    db
      .select({ total: count() })
      .from(eventAttendees)
      .innerJoin(eventRegistrations, eq(eventAttendees.registrationId, eventRegistrations.id))
      .where(
        and(
          eq(eventAttendees.eventId, eventId),
          eq(eventAttendees.isActive, true),
          eq(eventRegistrations.status, "confirmed"),
        ),
      ),
  ]);

  const registrations = registrationsRow?.total ?? 0;
  const attendance = attendanceRow?.total ?? 0;
  const confirmedSeats = confirmedSeatsRow?.total ?? 0;

  return {
    visits: event.visitCount,
    registrations,
    attendance,
    conversion: event.visitCount === 0 ? null : registrations / event.visitCount,
    confirmedSeats,
    capacity: event.capacity,
  };
}

export type SetEventWebhookResult =
  | { ok: true; event: EventRow }
  | { ok: false; reason: "forbidden" | "not_found" | "unsafe_url" };

// SSRF guard (security review finding): an ADMIN-supplied webhookUrl is still an
// attacker-reachable surface — a compromised or malicious admin account could point it at an
// internal service (cloud metadata endpoints, internal admin panels, the DB itself) and use this
// server as a proxy to reach it. Require HTTPS and reject any hostname that resolves to a
// loopback/private/link-local/unspecified address. A literal IP in the URL is checked directly,
// without a DNS lookup (nothing to resolve); a bare hostname resolves via `dns.lookup` ascertain
// every address it could mean — `{ all: true }` so a multi-A-record host can't hide one bad
// answer among good ones.
function isDisallowedIPv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n))) return true;
  const [a, b] = octets;
  if (a === 0) return true; // "this network"
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata, e.g. 169.254.169.254)
  return false;
}

function isDisallowedIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true; // loopback / unspecified
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // unique local fc00::/7
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isDisallowedIPv4(v4Mapped[1]);
  return false;
}

async function isWebhookUrlSafe(urlString: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  if (isIPv4(url.hostname)) return !isDisallowedIPv4(url.hostname);
  if (isIPv6(url.hostname)) return !isDisallowedIPv6(url.hostname);

  let records: { address: string; family: number }[];
  try {
    records = await dnsLookup(url.hostname, { all: true });
  } catch {
    return false; // unresolvable — reject rather than let a later lookup surprise us
  }
  if (records.length === 0) return false;
  return records.every((record) =>
    record.family === 6 ? !isDisallowedIPv6(record.address) : !isDisallowedIPv4(record.address),
  );
}

// Admin feedback round ("poder generar un webhook por evento"): the admin supplies the
// destination URL (their own CRM/Zapier/etc.), and a signing secret is generated here the first
// time a URL is saved with no secret yet — never regenerated on a later URL edit, so a receiver
// that already stored the secret to verify `x-webhook-secret` keeps working across URL changes.
export async function setEventWebhookUrl(input: {
  id: string;
  organizationId: string;
  actorId?: string;
  actorRole: UserRole;
  webhookUrl: string | null;
}): Promise<SetEventWebhookResult> {
  if (!(await canEditEvent(input))) return { ok: false, reason: "forbidden" };

  if (input.webhookUrl && !(await isWebhookUrlSafe(input.webhookUrl))) {
    return { ok: false, reason: "unsafe_url" };
  }

  const existing = await getEvent(input.id, input.organizationId);
  if (!existing) return { ok: false, reason: "not_found" };

  const webhookSecret =
    input.webhookUrl && !existing.webhookSecret ? generateOpaqueToken() : existing.webhookSecret;

  const [event] = await db
    .update(events)
    .set({ webhookUrl: input.webhookUrl, webhookSecret })
    .where(and(eq(events.id, input.id), eq(events.organizationId, input.organizationId)))
    .returning();
  if (!event) return { ok: false, reason: "not_found" };
  return { ok: true, event };
}

// A deliberate separate action from setEventWebhookUrl — rotating the secret is a security
// action an admin takes on purpose (the old secret stops verifying), never a side effect of
// editing the URL.
export async function regenerateEventWebhookSecret(input: {
  id: string;
  organizationId: string;
  actorRole: UserRole;
}): Promise<SetEventWebhookResult> {
  if (!isAdmin({ role: input.actorRole })) return { ok: false, reason: "forbidden" };

  const [event] = await db
    .update(events)
    .set({ webhookSecret: generateOpaqueToken() })
    .where(and(eq(events.id, input.id), eq(events.organizationId, input.organizationId)))
    .returning();
  if (!event) return { ok: false, reason: "not_found" };
  return { ok: true, event };
}

// Fire-and-forget: a failing/misconfigured receiver must never break the caller's own flow
// (registration, check-in). No retry/delivery-log infrastructure exists yet — a known gap, not
// silently promised. `type` is a dot-namespaced event name ("registration.created",
// "attendee.checked_in"); `data` is caller-shaped JSON, never includes the secret itself.
//
// Re-runs the SSRF safety check here too (not just at save time in setEventWebhookUrl): a
// hostname that resolved to a public IP when the admin saved the URL could resolve to an
// internal one by the time this actually fires (DNS rebinding). `redirect: "manual"` stops
// `fetch` from silently following a 3xx to an address that was never itself checked.
export async function notifyEventWebhook(
  event: Pick<EventRow, "webhookUrl" | "webhookSecret">,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!event.webhookUrl) return;
  if (!(await isWebhookUrlSafe(event.webhookUrl))) return;

  try {
    await fetch(event.webhookUrl, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        ...(event.webhookSecret ? { "x-webhook-secret": event.webhookSecret } : {}),
      },
      body: JSON.stringify({ type, data, sentAt: new Date().toISOString() }),
    });
  } catch {
    // Swallowed on purpose — see function doc comment.
  }
}
