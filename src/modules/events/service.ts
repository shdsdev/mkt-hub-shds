import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { isAdmin, type UserRole } from "@/modules/users";
import { events, eventRegistrations, eventAttendees } from "./db";

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

export type EventMutationResult =
  | { ok: true; event: EventRow }
  | { ok: false; reason: "forbidden" | "not_found" };

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
  startsAt: Date;
  endsAt?: Date;
  capacity?: number | null;
  reminderOffsetMinutes?: number | null;
  // spec.md "Fixed Optional Field Catalog" — omitted on create means the schema default (false).
  collectCompany?: boolean;
  collectJobTitle?: boolean;
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
      reminderOffsetMinutes: input.reminderOffsetMinutes,
      collectCompany: input.collectCompany,
      collectJobTitle: input.collectJobTitle,
    })
    .returning();
  return { ok: true, event };
}

export type UpdateEventChanges = Partial<{
  name: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  reminderOffsetMinutes: number | null;
  collectCompany: boolean;
  collectJobTitle: boolean;
}>;

export async function updateEvent(input: {
  id: string;
  organizationId: string;
  actorRole: UserRole;
  changes: UpdateEventChanges;
}): Promise<EventMutationResult> {
  if (!isAdmin({ role: input.actorRole })) return { ok: false, reason: "forbidden" };

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

export async function listEvents(organizationId: string): Promise<EventRow[]> {
  return db
    .select()
    .from(events)
    .where(eq(events.organizationId, organizationId))
    .orderBy(desc(events.createdAt));
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
function isDuplicateEmailViolation(error: unknown): boolean {
  const pgError = error as { code?: string; constraint_name?: string } | undefined;
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

      let status: "confirmed" | "waitlisted" = "confirmed";
      if (event.capacity !== null) {
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
