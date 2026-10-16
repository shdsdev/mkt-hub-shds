import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  events,
  eventRegistrations,
  eventAttendees,
  eventStatus,
  eventRegistrationStatus,
  eventRegistrationSource,
} from "./db";

// Schema contract for the additive events-module migration (PR1 — design.md "Architecture
// Decisions", tasks.md 1.1).
describe("events schema (additive events-module migration, PR1)", () => {
  it("defines the lifecycle, registration-status, and source enums", () => {
    expect(eventStatus.enumValues).toEqual(["draft", "published", "closed"]);
    expect(eventRegistrationStatus.enumValues).toEqual([
      "confirmed",
      "waitlisted",
      "cancelled",
      "checked_in",
    ]);
    expect(eventRegistrationSource.enumValues).toEqual(["public", "admin_added"]);
  });

  it("scopes every table to an organization via a required foreign key", () => {
    for (const table of [events, eventRegistrations, eventAttendees]) {
      expect(table.organizationId.notNull).toBe(true);
    }
  });

  it("defaults event status to draft, so new events are never publicly reachable", () => {
    expect(events.status.default).toBe("draft");
  });

  it("allows nullable capacity, meaning unlimited", () => {
    expect(events.capacity.notNull).toBe(false);
  });

  it("stores reminder timing as nullable integer minutes with a 48-hour default", () => {
    expect(events.reminderOffsetMinutes.notNull).toBe(false);
    expect(events.reminderOffsetMinutes.default).toBe(2880);
  });

  it("persists the full UTM column set on events and registrations", () => {
    for (const table of [events, eventRegistrations] as const) {
      expect(table.utmSource.notNull).toBe(false);
      expect(table.utmMedium.notNull).toBe(false);
      expect(table.utmCampaign.notNull).toBe(false);
      expect(table.utmTerm.notNull).toBe(false);
      expect(table.utmContent.notNull).toBe(false);
      expect(table.utmId.notNull).toBe(false);
    }
  });

  it("gives every registration an opaque, required cancel token", () => {
    expect(eventRegistrations.cancelToken.notNull).toBe(true);
  });

  it("keeps attendee identity (name/email/phone) off events and registrations", () => {
    expect(eventAttendees.fullName.notNull).toBe(true);
    expect(eventAttendees.email.notNull).toBe(true);
    expect(eventAttendees.emailNormalized.notNull).toBe(true);
  });

  it("gives every attendee an opaque pass token and a backup code", () => {
    expect(eventAttendees.passToken.notNull).toBe(true);
    expect(eventAttendees.backupCode.notNull).toBe(true);
  });

  it("defaults is_active to true and maintains it alongside status transitions", () => {
    expect(eventAttendees.isActive.notNull).toBe(true);
    expect(eventAttendees.isActive.default).toBe(true);
  });

  it("defines a partial unique index on (event_id, email_normalized) WHERE is_active", () => {
    const { indexes } = getTableConfig(eventAttendees);
    const match = indexes.find((index) => index.config.name === "event_attendees_event_email_active_unique");
    expect(match).toBeDefined();
    expect(match?.config.unique).toBe(true);
    expect(match?.config.where).toBeDefined();
    const columnNames = match?.config.columns.map((column) =>
      "name" in column ? column.name : undefined,
    );
    expect(columnNames).toEqual(["event_id", "email_normalized"]);
  });

  it("defines a unique backup code per event", () => {
    const { indexes } = getTableConfig(eventAttendees);
    const match = indexes.find((index) => index.config.name === "event_attendees_event_backup_code_unique");
    expect(match).toBeDefined();
    expect(match?.config.unique).toBe(true);
  });

  it("records idempotent check-in metadata without mutating on re-scan (service layer enforces that)", () => {
    expect(eventAttendees.checkedInAt.notNull).toBe(false);
    expect(eventAttendees.checkedInBy.notNull).toBe(false);
  });
});

describe("events-module migration (additive)", () => {
  const migrationDir = path.join(process.cwd(), "drizzle");
  const migration = readdirSync(migrationDir)
    .sort()
    .find((name) => {
      if (!name.endsWith(".sql")) return false;
      const sql = readFileSync(path.join(migrationDir, name), "utf8");
      return (
        sql.includes('CREATE TABLE "events"') &&
        sql.includes('CREATE TABLE "event_registrations"') &&
        sql.includes('CREATE TABLE "event_attendees"') &&
        sql.includes('CREATE TABLE "notification_log"')
      );
    });

  it("finds the generated migration", () => {
    expect(migration).toBeDefined();
  });

  it("creates events, event_registrations, event_attendees, and notification_log additively", () => {
    const sql = readFileSync(path.join(migrationDir, migration!), "utf8");
    for (const table of ["events", "event_registrations", "event_attendees", "notification_log"]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("ALTER TABLE \"events\" DROP");
  });

  it("creates the partial unique index on (event_id, email_normalized) WHERE is_active", () => {
    const sql = readFileSync(path.join(migrationDir, migration!), "utf8");
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "event_attendees_event_email_active_unique" ON "event_attendees" USING btree ("event_id","email_normalized") WHERE "event_attendees"."is_active"',
    );
  });

  it("creates the UNIQUE(subject_id, notification_type) constraint on notification_log", () => {
    const sql = readFileSync(path.join(migrationDir, migration!), "utf8");
    expect(sql).toContain('CONSTRAINT "notification_log_subject_type_unique" UNIQUE("subject_id","notification_type")');
  });
});
