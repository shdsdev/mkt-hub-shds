import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { isAdmin, type UserRole } from "@/modules/users";
import { events } from "./db";

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
// this is the only read path that route can use, so a draft never has a row to return.
export async function getPublishedEventBySlug(slug: string): Promise<EventRow | undefined> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.status, "published")))
    .limit(1);
  return rows[0];
}
