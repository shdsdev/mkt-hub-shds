import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations, users } from "@/modules/users/db";
import type { RegistrationFormConfig } from "./registration-form-config";

// Agenda is a short, admin-ordered list of time blocks — not a scheduling system (no per-item
// speakers/rooms by the original module's non-goals). `time` is free text ("10:00 AM", "Welcome")
// rather than a Date: an agenda item describes a point in the day's flow, not a reminder-eligible
// instant, and admins write it exactly as it should read on the landing page.
export type AgendaItem = { time: string; title: string; description?: string };
export type SponsorLogo = { url: string; name?: string };

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
  checkInConfirmationRequired: boolean("check_in_confirmation_required").notNull().default(true),
  // spec.md "Fixed Optional Field Catalog" — a small FIXED, predefined set of optional
  // registration-form fields an ADMIN can toggle per event. No free-form field builder: adding a
  // new optional field means adding a new column here, never a user-defined schema. Both default
  // false ("Optional field disabled by default" scenario). `event_attendees.company`/`job_title`
  // (PR1) are the data sinks these toggles control; PR3 wires the public form to read them.
  collectCompany: boolean("collect_company").notNull().default(false),
  collectJobTitle: boolean("collect_job_title").notNull().default(false),
  registrationFormConfig: jsonb("registration_form_config").$type<RegistrationFormConfig | null>(),
  // Acquisition source capture — column set and naming reused exactly from
  // `src/modules/links/db.ts` (design.md "Interfaces"), read/validated via `@/modules/utm`.
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  utmId: text("utm_id"),
  // design.md "Open Questions" (resolved in PR5): the dashboard's "visits" counter is its own
  // column, incremented by the public landing page view — explicitly NOT a write into
  // `tracking_events` (that table is analytics' own link/QR click-tracking concern; events stays
  // a leaf consumer of @/modules/analytics' public index, never a writer to its tables). A plain
  // counter, not a visits log: no per-visit row, no UTM/IP capture here — this is a landing-page
  // view count for a conversion ratio, not an analytics feature in its own right.
  visitCount: integer("visit_count").notNull().default(0),
  // Landing-page content model (grill-me session, this round): optional hero image for the public
  // landing; `agenda`/`sponsorLogos` are short admin-ordered lists, not relational tables — an
  // event has at most a handful of each, and the array's order IS the display order, so a
  // dedicated child table would only add a sort-column problem to solve.
  heroImageUrl: text("hero_image_url"),
  agenda: jsonb("agenda").$type<AgendaItem[]>().notNull().default(sql`'[]'::jsonb`),
  sponsorLogos: jsonb("sponsor_logos").$type<SponsorLogo[]>().notNull().default(sql`'[]'::jsonb`),
  // Outbound notification (admin feedback round: "poder generar un webhook por evento") — admin
  // supplies the destination URL (their own CRM/Zapier/etc.), we generate the signing secret.
  // Both nullable: no webhook configured is the default, and `webhookUrl` without a secret never
  // happens (the secret is generated the moment a URL is first saved — see
  // `setEventWebhookUrl`/`regenerateEventWebhookSecret` in service.ts).
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("events_agenda_is_array", sql`jsonb_typeof(${table.agenda}) = 'array'`),
  check("events_sponsor_logos_is_array", sql`jsonb_typeof(${table.sponsorLogos}) = 'array'`),
]);

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
  clientBrands: jsonb("client_brands").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  interests: jsonb("interests").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  requestedMoreCompanions: boolean("requested_more_companions").notNull().default(false),
  consents: jsonb("consents").$type<RegistrationConsents | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RegistrationConsents = {
  privacyAcceptedAt: string;
  termsAcceptedAt: string;
  marketingAcceptedAt?: string;
};

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
    occupation: text("occupation"),
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

export const eventReceptionists = pgTable(
  "event_receptionists",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("event_receptionists_event_user_unique").on(table.eventId, table.userId)],
);

export const eventsTables = {
  eventStatus,
  eventRegistrationStatus,
  eventRegistrationSource,
  events,
  eventRegistrations,
  eventAttendees,
  eventReceptionists,
} as const;
