import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { events, eventRegistrations, eventAttendees } from "./db";
import { emailContacts, emailContactEvents, notificationLog, userNotifications, auditLogs } from "@/db/schema";

const holder = vi.hoisted(() => ({ current: undefined as ReturnType<typeof drizzle> | undefined,
  beforeCommit: undefined as (() => Promise<void>) | undefined }));
vi.mock("@/db/client", () => ({ db: {
  transaction: (callback: Parameters<ReturnType<typeof drizzle>["transaction"]>[0]) => {
    const beforeCommit = holder.beforeCommit;
    return holder.current!.transaction(async (tx) => {
      const result = await callback(tx);
      await beforeCommit?.();
      return result;
    });
  },
} }));
vi.mock("@/modules/users", () => ({ isAdmin: (profile: { role: string }) => profile.role === "ADMIN" }));

import { deleteUnapprovedRegistration } from "./service";
import { syncEventAttendeeContact } from "@/modules/email-marketing";
import { createInternalNotifications } from "@/modules/notifications";

// Opt-in only. This harness creates and destroys its own container, never reads DATABASE_URL,
// and runs only migration 0078 against a minimal pre-migration schema, not a deployed database.
describe.skipIf(process.env.RUN_REGISTRATION_DELETION_POSTGRES_TESTS !== "1")("registration deletion on disposable Postgres", () => {
  const container = `hub-mkt-registration-test-${randomUUID()}`;
  const organizationId = randomUUID();
  const eventId = randomUUID();
  const actorId = randomUUID();
  const legacyUntouched = randomUUID();
  const legacyRejected = randomUUID();
  let client: ReturnType<typeof postgres> | undefined;
  const dialect = new PgDialect();

  beforeAll(async () => {
    execFileSync("docker", ["run", "-d", "--rm", "--pull", "never", "--name", container,
      "-p", "127.0.0.1::5432", "-e", "POSTGRES_PASSWORD=isolated-test-only", "postgres:16"], { timeout: 30_000 });
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split(":").at(-1)!;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        execFileSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { stdio: "pipe" });
        break;
      } catch {
        if (attempt === 59) throw new Error("Disposable Postgres did not become ready.");
        await delay(250);
      }
    }
    client = postgres(`postgres://postgres:isolated-test-only@127.0.0.1:${port}/postgres`, { max: 5 });
    holder.current = drizzle(client);
    for (const table of [events, eventRegistrations, eventAttendees, emailContacts, emailContactEvents, notificationLog, userNotifications, auditLogs]) {
      const config = getTableConfig(table);
      const columns = config.columns.filter((column) => !["first_approved_at", "deletion_protected"].includes(column.name)).map((column) => {
        const type = column.enumValues?.length ? "text" : column.getSQLType();
        let definition = `"${column.name}" ${type}`;
        if (column.name === "id") return `${definition} primary key default gen_random_uuid()`;
        if (column.default !== undefined) {
          const value = column.default;
          const expression = value instanceof SQL ? dialect.sqlToQuery(value).sql
            : typeof value === "boolean" || typeof value === "number" ? String(value)
              : `'${(typeof value === "string" ? value : JSON.stringify(value)).replaceAll("'", "''")}'`;
          definition += ` default ${expression}`;
        }
        return definition;
      });
      await client.unsafe(`create table "${config.name}" (${columns.join(", ")})`);
    }
    await client.unsafe(`
      alter table event_attendees add foreign key (registration_id) references event_registrations(id);
      alter table email_contacts add unique (organization_id, email_normalized);
      alter table email_contact_events add unique (organization_id, contact_id, event_id);
      create table event_benefit_redemptions (registration_id uuid, attendee_id uuid);
      create table raffle_draws (attendee_id uuid, eligible_attendee_ids jsonb default '[]');
    `);
    await client`insert into events (id, organization_id) values (${eventId}, ${organizationId})`;
    await client`insert into event_registrations (id, organization_id, event_id, status, source, review_status)
      values (${legacyUntouched}, ${organizationId}, ${eventId}, 'pending_review', 'public', 'new'),
             (${legacyRejected}, ${organizationId}, ${eventId}, 'rejected', 'public', 'rejected')`;
    const migration = readFileSync("drizzle/0078_registration_deletion_guard.sql", "utf8");
    await client.begin(async (tx) => {
      for (const statement of migration.split("--> statement-breakpoint")) await tx.unsafe(statement);
    });
  }, 60_000);

  afterAll(async () => {
    try { await client?.end({ timeout: 5 }); }
    finally { execFileSync("docker", ["rm", "-f", container], { stdio: "pipe", timeout: 15_000 }); }
  });

  it("executes the conservative backfill and enforces sticky markers in SQL", async () => {
    const rows = await client!`select id, deletion_protected from event_registrations`;
    expect(rows.find((row) => row.id === legacyUntouched)?.deletion_protected).toBe(false);
    expect(rows.find((row) => row.id === legacyRejected)?.deletion_protected).toBe(true);
    await client!`update event_registrations set review_status = 'approved', status = 'confirmed' where id = ${legacyUntouched}`;
    const [approved] = await client!`select first_approved_at from event_registrations where id = ${legacyUntouched}`;
    await client!`update event_registrations set review_status = 'rejected', status = 'rejected', first_approved_at = null where id = ${legacyUntouched}`;
    const [rejected] = await client!`select first_approved_at from event_registrations where id = ${legacyUntouched}`;
    expect(rejected.first_approved_at).toEqual(approved.first_approved_at);
    expect(rejected.first_approved_at).not.toBeNull();
    await client!`update event_registrations set deletion_protected = false where id = ${legacyRejected}`;
    const [protectedRow] = await client!`select deletion_protected from event_registrations where id = ${legacyRejected}`;
    expect(protectedRow.deletion_protected).toBe(true);
  });

  it("cleans only owned notification subjects and email memberships, retaining other events and types", async () => {
    const registrationId = randomUUID();
    const attendeeId = randomUUID();
    const companionId = randomUUID();
    const otherSubjectId = randomUUID();
    const otherOrganizationId = randomUUID();
    const contactId = randomUUID();
    const otherEventId = randomUUID();
    await client!`insert into event_registrations (id, organization_id, event_id) values (${registrationId}, ${organizationId}, ${eventId})`;
    await client!`insert into event_attendees (id, organization_id, event_id, registration_id)
      values (${attendeeId}, ${organizationId}, ${eventId}, ${registrationId}), (${companionId}, ${organizationId}, ${eventId}, ${registrationId})`;
    for (const subjectId of [registrationId, attendeeId, companionId, otherSubjectId]) {
      await client!`insert into user_notifications (organization_id, subject_id, type)
        values (${organizationId}, ${subjectId}, 'registration_submitted'), (${organizationId}, ${subjectId}, 'registration_review_blocked'),
               (${organizationId}, ${subjectId}, 'registration_decision')`;
      await client!`insert into notification_log (organization_id, subject_id, subject_type, notification_type)
        values (${organizationId}, ${subjectId}, 'event_attendee', 'registration_rejected'),
               (${organizationId}, ${subjectId}, 'event_attendee', 'reminder')`;
    }
    await client!`insert into user_notifications (organization_id, subject_id, type)
      values (${organizationId}, ${registrationId}, 'checklist_task_due'), (${otherOrganizationId}, ${attendeeId}, 'registration_submitted')`;
    await client!`insert into notification_log (organization_id, subject_id, subject_type, notification_type)
      values (${organizationId}, ${attendeeId}, 'raffle_draw', 'winner_email'),
             (${otherOrganizationId}, ${attendeeId}, 'event_attendee', 'confirmation')`;
    await client!`insert into email_contacts (id, organization_id, email_normalized) values (${contactId}, ${organizationId}, 'retained@example.test')`;
    await client!`insert into email_contact_events (organization_id, contact_id, event_id, attendee_id)
      values (${organizationId}, ${contactId}, ${eventId}, ${attendeeId}), (${organizationId}, ${contactId}, ${otherEventId}, ${otherSubjectId})`;
    await expect(deleteUnapprovedRegistration({ registrationId, eventId, organizationId, actorId }))
      .resolves.toEqual({ ok: true, registrationId, attendeeCount: 2 });
    expect(await client!`select * from event_attendees where registration_id = ${registrationId}`).toHaveLength(0);
    expect(await client!`select * from event_registrations where id = ${registrationId}`).toHaveLength(0);
    expect(await client!`select * from user_notifications`).toHaveLength(5);
    expect(await client!`select * from notification_log`).toHaveLength(4);
    expect(await client!`select * from email_contacts where id = ${contactId}`).toHaveLength(1);
    expect(await client!`select event_id from email_contact_events where contact_id = ${contactId}`)
      .toEqual([expect.objectContaining({ event_id: otherEventId })]);
  });

  it("rejects deleted, cross-event, cross-organization and orphaned attendees before contact writes", async () => {
    const registrationId = randomUUID();
    const attendeeId = randomUUID();
    const otherEventId = randomUUID();
    const otherOrganizationId = randomUUID();
    const otherOrganizationEventId = randomUUID();
    await client!`insert into events (id, organization_id) values
      (${otherEventId}, ${organizationId}), (${otherOrganizationEventId}, ${otherOrganizationId})`;
    await client!`insert into event_registrations (id, organization_id, event_id) values (${registrationId}, ${organizationId}, ${eventId})`;
    await client!`insert into event_attendees (id, organization_id, event_id, registration_id) values (${attendeeId}, ${organizationId}, ${eventId}, ${registrationId})`;
    const base = { eventId, organizationId, attendeeId, email: "sync@example.test", fullName: "Test Contact" };
    for (const input of [{ ...base, attendeeId: randomUUID() }, { ...base, eventId: otherEventId },
      { ...base, organizationId: otherOrganizationId, eventId: otherOrganizationEventId }, { ...base, organizationId: otherOrganizationId }]) {
      await expect(syncEventAttendeeContact(input)).rejects.toThrow("Event attendee no longer exists");
    }
    // An intact attendee can still sync; a subsequent deletion must remove its membership.
    const synced = await syncEventAttendeeContact(base);
    await deleteUnapprovedRegistration({ registrationId, eventId, organizationId, actorId });
    await expect(syncEventAttendeeContact(base)).rejects.toThrow("Event attendee no longer exists");
    expect(await client!`select * from email_contact_events where attendee_id = ${attendeeId}`).toHaveLength(0);
    const [contact] = await client!`select full_name from email_contacts where id = ${synced.contactId}`;
    expect(contact.full_name).toBe("Test Contact");
    const orphanId = randomUUID();
    await client!`insert into event_attendees (id, organization_id, event_id) values (${orphanId}, ${organizationId}, ${eventId})`;
    await expect(syncEventAttendeeContact({ ...base, attendeeId: orphanId, fullName: "Must Not Overwrite" })).rejects.toThrow("Event attendee no longer exists");
    const [retained] = await client!`select full_name from email_contacts where id = ${synced.contactId}`;
    expect(retained.full_name).toBe("Test Contact");
  });

  it("waits for an in-flight deletion and cannot recreate the contact membership after commit", async () => {
    const registrationId = randomUUID();
    const attendeeId = randomUUID();
    await client!`insert into event_registrations (id, organization_id, event_id) values (${registrationId}, ${organizationId}, ${eventId})`;
    await client!`insert into event_attendees (id, organization_id, event_id, registration_id) values (${attendeeId}, ${organizationId}, ${eventId}, ${registrationId})`;
    let unlock!: () => void;
    let locked!: () => void;
    const barrier = new Promise<void>((resolve) => { unlock = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const deletion = client!.begin(async (tx) => {
      await tx`select id from events where id = ${eventId} for update`;
      await tx`delete from event_attendees where id = ${attendeeId}`;
      await tx`delete from event_registrations where id = ${registrationId}`;
      locked();
      await barrier;
    });
    try {
      await ready;
      const sync = syncEventAttendeeContact({ organizationId, eventId, attendeeId, email: "race@example.test", fullName: "Test Contact" })
        .then(() => "unexpected success", (error: Error) => error.message);
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const locks = await client!`select 1 from pg_stat_activity where wait_event_type = 'Lock'
          and query like '%select id from events where id =%'`;
        if (locks.length > 0) { waiting = true; break; }
        await delay(10);
      }
      expect(waiting).toBe(true);
      expect(await client!`select * from email_contacts where email_normalized = 'race@example.test'`).toHaveLength(0);
      unlock();
      await deletion;
      expect(await sync).toContain("Event attendee no longer exists");
      expect(await client!`select * from email_contact_events where attendee_id = ${attendeeId}`).toHaveLength(0);
    } finally {
      unlock();
      await deletion;
    }
  });

  it("rolls back registration, attendees, notifications and membership when audit insertion fails", async () => {
    const registrationId = randomUUID();
    const attendeeId = randomUUID();
    const contactId = randomUUID();
    await client!`insert into event_registrations (id, organization_id, event_id) values (${registrationId}, ${organizationId}, ${eventId})`;
    await client!`insert into event_attendees (id, organization_id, event_id, registration_id) values (${attendeeId}, ${organizationId}, ${eventId}, ${registrationId})`;
    await client!`insert into email_contact_events (organization_id, contact_id, event_id, attendee_id) values (${organizationId}, ${contactId}, ${eventId}, ${attendeeId})`;
    await client!`insert into user_notifications (organization_id, subject_id, type) values (${organizationId}, ${registrationId}, 'registration_submitted')`;
    await client!.unsafe(`create function fail_registration_audit() returns trigger language plpgsql as $$
      begin if NEW.resource_id = '${registrationId}'::uuid then raise exception 'audit unavailable'; end if; return NEW; end; $$;
      create trigger fail_registration_audit before insert on audit_logs for each row execute function fail_registration_audit();`);
    try {
      await expect(deleteUnapprovedRegistration({ registrationId, eventId, organizationId, actorId })).rejects.toMatchObject({
        cause: expect.objectContaining({ message: expect.stringContaining("audit unavailable") }),
      });
      expect(await client!`select id from event_registrations where id = ${registrationId}`).toHaveLength(1);
      expect(await client!`select id from event_attendees where id = ${attendeeId}`).toHaveLength(1);
      expect(await client!`select id from user_notifications where subject_id = ${registrationId}`).toHaveLength(1);
      expect(await client!`select contact_id from email_contact_events where attendee_id = ${attendeeId}`).toHaveLength(1);
      expect(await client!`select id from audit_logs where resource_id = ${registrationId}`).toHaveLength(0);
    } finally {
      await client!.unsafe("drop trigger fail_registration_audit on audit_logs; drop function fail_registration_audit();");
    }
  });

  it("waits for an approval in progress and refuses deletion after its commit", async () => {
    const registrationId = randomUUID();
    await client!`insert into event_registrations (id, organization_id, event_id) values (${registrationId}, ${organizationId}, ${eventId})`;
    let unlock!: () => void;
    let locked!: () => void;
    const barrier = new Promise<void>((resolve) => { unlock = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const approval = client!.begin(async (tx) => {
      await tx`select id from events where id = ${eventId} for update`;
      await tx`update event_registrations set review_status = 'approved', status = 'confirmed' where id = ${registrationId}`;
      locked();
      await barrier;
    });
    try {
      await ready;
      const deletion = deleteUnapprovedRegistration({ registrationId, eventId, organizationId, actorId });
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const locks = await client!`select 1 from pg_stat_activity where wait_event_type = 'Lock' and query like '%select id from events where id =%'`;
        if (locks.length > 0) { waiting = true; break; }
        await delay(10);
      }
      expect(waiting).toBe(true);
      unlock();
      await approval;
      await expect(deletion).resolves.toEqual({ ok: false, reason: "protected" });
      expect(await client!`select id from event_registrations where id = ${registrationId}`).toHaveLength(1);
    } finally {
      unlock();
      await approval;
    }
  });

  it("ignores wrong-organization and late registration notifications after deletion", async () => {
    const registrationId = randomUUID();
    await client!`insert into event_registrations (id, organization_id, event_id) values (${registrationId}, ${organizationId}, ${eventId})`;
    const input = { organizationId, subjectId: registrationId, recipientUserIds: [actorId], type: "registration_submitted" as const,
      title: "Registration", body: "Review required", href: "/events", dedupeKey: registrationId };
    await createInternalNotifications({ ...input, organizationId: randomUUID() });
    expect(await client!`select id from user_notifications where subject_id = ${registrationId}`).toHaveLength(0);
    await createInternalNotifications(input);
    expect(await client!`select id from user_notifications where subject_id = ${registrationId}`).toHaveLength(1);
    await deleteUnapprovedRegistration({ registrationId, eventId, organizationId, actorId });
    for (const type of ["registration_submitted", "registration_review_blocked", "registration_decision"] as const) {
      await createInternalNotifications({ ...input, type });
    }
    expect(await client!`select id from user_notifications where subject_id = ${registrationId}`).toHaveLength(0);
  });

  it("lets an in-flight notification writer commit before deletion cleans its notification", async () => {
    const registrationId = randomUUID();
    await client!`insert into event_registrations (id, organization_id, event_id) values (${registrationId}, ${organizationId}, ${eventId})`;
    let unlock!: () => void;
    let locked!: () => void;
    const barrier = new Promise<void>((resolve) => { unlock = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    // Pause the real notification transaction after insertion, while KEY SHARE is held.
    holder.beforeCommit = async () => { locked(); await barrier; };
    const writer = createInternalNotifications({ organizationId, subjectId: registrationId, recipientUserIds: [actorId],
      type: "registration_submitted", title: "Registration", body: "Review required", href: "/events", dedupeKey: registrationId });
    try {
      await ready;
      holder.beforeCommit = undefined;
      const deletion = deleteUnapprovedRegistration({ registrationId, eventId, organizationId, actorId });
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const locks = await client!`select 1 from pg_stat_activity where wait_event_type = 'Lock'
          and query like '%from "event_registrations"%'`;
        if (locks.length > 0) { waiting = true; break; }
        await delay(10);
      }
      expect(waiting).toBe(true);
      unlock();
      await writer;
      await expect(deletion).resolves.toEqual({ ok: true, registrationId, attendeeCount: 0 });
      expect(await client!`select id from event_registrations where id = ${registrationId}`).toHaveLength(0);
      expect(await client!`select id from user_notifications where subject_id = ${registrationId}`).toHaveLength(0);
    } finally {
      holder.beforeCommit = undefined;
      unlock();
      await writer;
    }
  });

  it("makes a concurrent notification writer wait for deletion and skip insertion after commit", async () => {
    const registrationId = randomUUID();
    await client!`insert into event_registrations (id, organization_id, event_id) values (${registrationId}, ${organizationId}, ${eventId})`;
    let unlock!: () => void;
    let locked!: () => void;
    const barrier = new Promise<void>((resolve) => { unlock = resolve; });
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    holder.beforeCommit = async () => { locked(); await barrier; };
    const deletion = deleteUnapprovedRegistration({ registrationId, eventId, organizationId, actorId });
    try {
      await ready;
      holder.beforeCommit = undefined;
      const writer = createInternalNotifications({ organizationId, subjectId: registrationId, recipientUserIds: [actorId],
        type: "registration_submitted", title: "Registration", body: "Review required", href: "/events", dedupeKey: registrationId });
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const locks = await client!`select 1 from pg_stat_activity where wait_event_type = 'Lock'
          and query like '%from event_registrations%'`;
        if (locks.length > 0) { waiting = true; break; }
        await delay(10);
      }
      expect(waiting).toBe(true);
      unlock();
      await deletion;
      await writer;
      expect(await client!`select id from user_notifications where subject_id = ${registrationId}`).toHaveLength(0);
    } finally {
      holder.beforeCommit = undefined;
      unlock();
      await deletion;
    }
  });
});
