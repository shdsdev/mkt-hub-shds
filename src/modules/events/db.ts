import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "@/modules/users/db";

// Lifecycle status (design.md "event-management"): draft is never publicly reachable, published
// serves the public landing, closed stops new registrations without hiding history.
export const eventStatus = pgEnum("event_status", ["draft", "published", "closed"]);

// Booking-level status on `event_registrations` (design.md "Booking vs person"). `confirmed` and
// `waitlisted` are capacity outcomes; `cancelled` is terminal; `checked_in` mirrors the first
// attendee check-in on the registration (per-attendee `checked_in_at` on event_attendees remains
// the authoritative record).
export const eventRegistrationStatus = pgEnum("event_registration_status", [
  "confirmed",
  "waitlisted",
  "cancelled",
  "checked_in",
]);

// Public self-service vs staff-entered bookings (tasks.md 3.8) — same email/pass flow either way.
export const eventRegistrationSource = pgEnum("event_registration_source", [
  "public",
  "admin_added",
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: eventStatus("status").notNull().default("draft"),
  description: text("description"),
  location: text("location"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  // Nullable = unlimited capacity (design.md "Nullable Capacity" requirement).
  capacity: integer("capacity"),
  // Integer minutes before `startsAt` to send the reminder (design.md "Open Questions" —
  // integer minutes resolved over `interval`, trivially comparable in Drizzle/Postgres without an
  // interval driver mapping). Null = no reminder configured for this event.
  reminderOffsetMinutes: integer("reminder_offset_minutes"),
  // spec.md "Fixed Optional Field Catalog" — a small FIXED, predefined set of optional
  // registration-form fields an ADMIN can toggle per event. No free-form field builder: adding a
  // new optional field means adding a new column here, never a user-defined schema. Both default
  // false ("Optional field disabled by default" scenario). `event_attendees.company`/`job_title`
  // (PR1) are the data sinks these toggles control; PR3 wires the public form to read them.
  collectCompany: boolean("collect_company").notNull().default(false),
  collectJobTitle: boolean("collect_job_title").notNull().default(false),
  // Acquisition source capture — column set and naming reused exactly from
  // `src/modules/links/db.ts` (design.md "Interfaces"), read/validated via `@/modules/utm`.
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  utmId: text("utm_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One checkout action per registration, which may include N companions on `event_attendees`
// (design.md "Booking vs person"). Capacity is enforced on attendees, not registrations.
export const eventRegistrations = pgTable("event_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id),
  status: eventRegistrationStatus("status").notNull().default("confirmed"),
  source: eventRegistrationSource("source").notNull().default("public"),
  // Opaque, unguessable, revocable-by-update (design.md "Pass + cancel tokens") — no signing
  // secret, no expiry clock.
  cancelToken: text("cancel_token").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  utmId: text("utm_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Person-level identity (design.md "Contact identity" — the key decision): full_name/email/phone
// live here exactly once, never copied onto events/event_registrations, so a future CRM can
// migrate by `INSERT INTO contacts SELECT DISTINCT ON (email_normalized) ...` without this module
// inventing merge/dedupe rules first.
export const eventAttendees = pgTable(
  "event_attendees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => eventRegistrations.id),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    // Lowercased/trimmed form used by the partial unique index below — the only authority for
    // "same person, same event" (design.md "Active-email uniqueness").
    emailNormalized: text("email_normalized").notNull(),
    phone: text("phone"),
    company: text("company"),
    jobTitle: text("job_title"),
    // Opaque per-attendee pass token (QR payload) — same token family as `cancelToken`.
    passToken: text("pass_token").notNull(),
    // 8-char Crockford base32 (no I/L/O/U), unique per event, human-typeable at the door.
    backupCode: text("backup_code").notNull(),
    // Denormalized from the parent registration's status (design.md "Active-email uniqueness") —
    // a Postgres partial unique index cannot reference another table's column, so this flag is
    // maintained inside the same transaction as every registration status change.
    isActive: boolean("is_active").notNull().default(true),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: uuid("checked_in_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Rejects a second active registration for the same email on the same event, but allows
    // re-registering after cancellation (design.md "Active-email uniqueness").
    uniqueIndex("event_attendees_event_email_active_unique")
      .on(table.eventId, table.emailNormalized)
      .where(sql`${table.isActive}`),
    uniqueIndex("event_attendees_event_backup_code_unique").on(table.eventId, table.backupCode),
  ],
);

export const eventsTables = {
  eventStatus,
  eventRegistrationStatus,
  eventRegistrationSource,
  events,
  eventRegistrations,
  eventAttendees,
} as const;
