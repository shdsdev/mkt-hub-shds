import { afterAll, beforeEach, describe, it, expect, vi } from "vitest";

const {
  insertMock,
  updateMock,
  selectMock,
  transactionMock,
  txExecuteMock,
  txSelectMock,
  txInsertMock,
  txUpdateMock,
} = vi.hoisted(() => ({
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  selectMock: vi.fn(),
  transactionMock: vi.fn(),
  txExecuteMock: vi.fn(),
  txSelectMock: vi.fn(),
  txInsertMock: vi.fn(),
  txUpdateMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    insert: insertMock,
    update: updateMock,
    select: selectMock,
    transaction: transactionMock,
  },
}));

// Avoids pulling the real `@/modules/users` barrel into this unit test — that barrel re-exports
// `management.ts`, which imports `src/lib/supabase/admin.ts` (`import "server-only"`), a package
// not resolvable under Vitest's plain Node environment (pre-existing repo condition, unrelated to
// this PR). Production code still imports the real barrel (ARCHITECTURE.md I-4).
vi.mock("@/modules/users", () => ({
  isAdmin: (profile: { role: string }) => profile.role === "ADMIN",
}));

import { and, eq } from "drizzle-orm";
import { events, eventRegistrations, eventAttendees } from "./db";
import {
  CROCKFORD_BASE32_ALPHABET,
  generateBackupCode,
  generateOpaqueToken,
  normalizeEmail,
  createEvent,
  updateEvent,
  setEventStatus,
  listEvents,
  getEvent,
  getPublishedEventBySlug,
  getPublishedEventBySlugPublic,
  getRegistrationByCancelToken,
  registerForEvent,
  cancelRegistrationByToken,
  isReminderDue,
  listDueReminderAttendees,
  checkInAttendee,
  recordEventVisit,
  listRegistrations,
  getEventInsights,
  addAttendeeToRegistration,
  setEventWebhookUrl,
  regenerateEventWebhookSecret,
  notifyEventWebhook,
} from "./service";

// Chainable mock builders matching the project's established pattern
// (src/modules/users/management.test.ts `query()` helper).
function insertChain(rows: unknown[]) {
  const chain = { values: vi.fn(), returning: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue(rows);
  return chain;
}

function updateChain(rows: unknown[]) {
  const chain = { set: vi.fn(), where: vi.fn(), returning: vi.fn() };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.returning.mockResolvedValue(rows);
  return chain;
}

function selectChain<T>(rows: T[]) {
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

const baseEvent = {
  id: "event-1",
  organizationId: "org-1",
  name: "Launch Day",
  slug: "launch-day",
  status: "draft" as const,
  description: null,
  location: null,
  startsAt: new Date("2026-11-01T18:00:00Z"),
  endsAt: null,
  capacity: null,
  reminderOffsetMinutes: null,
  collectCompany: false,
  collectJobTitle: false,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  utmId: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

describe("events service — ADMIN-only authoring (design.md 'event-management')", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies event creation for a non-admin and persists no change", async () => {
    const result = await createEvent({
      organizationId: "org-1",
      actorRole: "MARKETING_USER",
      name: "Launch Day",
      slug: "launch-day",
      startsAt: new Date("2026-11-01T18:00:00Z"),
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("creates an event for ADMIN with status defaulting through the schema", async () => {
    insertMock.mockReturnValue(insertChain([baseEvent]));

    const result = await createEvent({
      organizationId: "org-1",
      actorRole: "ADMIN",
      name: "Launch Day",
      slug: "launch-day",
      startsAt: new Date("2026-11-01T18:00:00Z"),
      capacity: null,
    });

    expect(result).toEqual({ ok: true, event: baseEvent });
    expect(insertMock).toHaveBeenCalledOnce();
  });

  it("denies event edits for a non-admin and persists no change", async () => {
    const result = await updateEvent({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "VIEWER",
      changes: { name: "Renamed" },
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates an event for ADMIN", async () => {
    const updated = { ...baseEvent, name: "Renamed" };
    updateMock.mockReturnValue(updateChain([updated]));

    const result = await updateEvent({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
      changes: { name: "Renamed" },
    });

    expect(result).toEqual({ ok: true, event: updated });
  });

  it("returns not_found when the target event does not belong to the organization", async () => {
    updateMock.mockReturnValue(updateChain([]));

    const result = await updateEvent({
      id: "event-1",
      organizationId: "org-2",
      actorRole: "ADMIN",
      changes: { name: "Renamed" },
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("denies publish/close transitions for a non-admin", async () => {
    const result = await setEventStatus({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "MARKETING_MANAGER",
      status: "published",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("publishes a draft event for ADMIN, making it publicly reachable", async () => {
    const published = { ...baseEvent, status: "published" as const };
    updateMock.mockReturnValue(updateChain([published]));

    const result = await setEventStatus({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
      status: "published",
    });

    expect(result).toEqual({ ok: true, event: published });
  });

  it("closes a published event for ADMIN", async () => {
    const closed = { ...baseEvent, status: "closed" as const };
    updateMock.mockReturnValue(updateChain([closed]));

    const result = await setEventStatus({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
      status: "closed",
    });

    expect(result).toEqual({ ok: true, event: closed });
  });

  it("creates an event with the fixed optional-field toggles disabled by default (spec.md 'Fixed Optional Field Catalog')", async () => {
    insertMock.mockReturnValue(insertChain([baseEvent]));

    const result = await createEvent({
      organizationId: "org-1",
      actorRole: "ADMIN",
      name: "Launch Day",
      slug: "launch-day",
      startsAt: new Date("2026-11-01T18:00:00Z"),
    });

    expect(result).toEqual({ ok: true, event: baseEvent });
    if (result.ok) {
      expect(result.event.collectCompany).toBe(false);
      expect(result.event.collectJobTitle).toBe(false);
    }
  });

  it("creates an event enabling the company and job-title optional fields from the fixed catalog", async () => {
    const withToggles = { ...baseEvent, collectCompany: true, collectJobTitle: true };
    const chain = insertChain([withToggles]);
    insertMock.mockReturnValue(chain);

    const result = await createEvent({
      organizationId: "org-1",
      actorRole: "ADMIN",
      name: "Launch Day",
      slug: "launch-day",
      startsAt: new Date("2026-11-01T18:00:00Z"),
      collectCompany: true,
      collectJobTitle: true,
    });

    expect(result).toEqual({ ok: true, event: withToggles });
    // Real assertion that production code passes the toggles through to the insert, not just that
    // the mocked row happens to carry them.
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ collectCompany: true, collectJobTitle: true }),
    );
  });

  it("updates an event's optional-field toggles and reads the change back", async () => {
    const updated = { ...baseEvent, collectCompany: true };
    updateMock.mockReturnValue(updateChain([updated]));

    const result = await updateEvent({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
      changes: { collectCompany: true },
    });

    expect(result).toEqual({ ok: true, event: updated });
    if (result.ok) expect(result.event.collectCompany).toBe(true);
  });

  it("creates an event with a hero image, agenda, and sponsor logos (landing content model)", async () => {
    const agenda = [{ time: "10:00 AM", title: "Registro" }];
    const sponsorLogos = [{ url: "https://cdn.example.com/sponsor.png", name: "Acme" }];
    const withContent = { ...baseEvent, heroImageUrl: "https://cdn.example.com/hero.jpg", agenda, sponsorLogos };
    const chain = insertChain([withContent]);
    insertMock.mockReturnValue(chain);

    const result = await createEvent({
      organizationId: "org-1",
      actorRole: "ADMIN",
      name: "Launch Day",
      slug: "launch-day",
      startsAt: new Date("2026-11-01T18:00:00Z"),
      heroImageUrl: "https://cdn.example.com/hero.jpg",
      agenda,
      sponsorLogos,
    });

    expect(result).toEqual({ ok: true, event: withContent });
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        heroImageUrl: "https://cdn.example.com/hero.jpg",
        agenda,
        sponsorLogos,
      }),
    );
  });

  it("updates an event's agenda and reads the change back", async () => {
    const agenda = [{ time: "9:00 AM", title: "Apertura" }, { time: "11:00 AM", title: "Cierre" }];
    const updated = { ...baseEvent, agenda };
    const chain = updateChain([updated]);
    updateMock.mockReturnValue(chain);

    const result = await updateEvent({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
      changes: { agenda },
    });

    expect(result).toEqual({ ok: true, event: updated });
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ agenda }));
  });

  it("accepts a null capacity, meaning unlimited", async () => {
    insertMock.mockReturnValue(insertChain([{ ...baseEvent, capacity: null }]));

    const result = await createEvent({
      organizationId: "org-1",
      actorRole: "ADMIN",
      name: "Unlimited Event",
      slug: "unlimited-event",
      startsAt: new Date("2026-11-01T18:00:00Z"),
      capacity: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.capacity).toBeNull();
  });
});

describe("events service — read paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists events scoped to the organization", async () => {
    selectMock.mockReturnValue(selectChain([baseEvent]));

    const result = await listEvents("org-1");
    expect(result).toEqual([baseEvent]);
  });

  it("gets a single event scoped to the organization", async () => {
    selectMock.mockReturnValue(selectChain([baseEvent]));

    const result = await getEvent("event-1", "org-1");
    expect(result).toEqual(baseEvent);
  });

  it("returns undefined when the event is missing or belongs to another organization", async () => {
    selectMock.mockReturnValue(selectChain([]));

    const result = await getEvent("event-1", "org-2");
    expect(result).toBeUndefined();
  });

  it("returns a published event by slug, querying with the exact slug+status+organization predicate", async () => {
    const published = { ...baseEvent, status: "published" as const };
    const chain = selectChain([published]);
    selectMock.mockReturnValue(chain);

    const result = await getPublishedEventBySlug("launch-day", "org-1");

    expect(result).toEqual(published);
    // Pins the actual WHERE predicate to slug + status='published' + organizationId (verify-report
    // C3/W4 remediation). The mock can't execute real SQL, so this asserts the exact `and(eq(...))`
    // condition object the service builds and hands to `.where(...)` — deleting or loosening the
    // `eq(events.status, "published")` clause (or dropping organization scoping) changes that
    // object and fails this assertion even though `.returning`/mocked rows stay unchanged.
    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(events.slug, "launch-day"),
        eq(events.status, "published"),
        eq(events.organizationId, "org-1"),
      ),
    );
  });

  it("returns undefined for a draft event's slug, since the pinned query filters status=published", async () => {
    // The mock can't evaluate the WHERE clause itself, so the companion test above pins the exact
    // predicate object; this test documents the function's contract on the no-rows branch.
    selectMock.mockReturnValue(selectChain([]));

    const result = await getPublishedEventBySlug("draft-only-event", "org-1");
    expect(result).toBeUndefined();
  });

  it("resolves a published event by slug ALONE (no organization in scope yet — the public route has no session)", async () => {
    const published = { ...baseEvent, status: "published" as const };
    const chain = selectChain([published]);
    selectMock.mockReturnValue(chain);

    const result = await getPublishedEventBySlugPublic("launch-day");

    expect(result).toEqual(published);
    expect(chain.where).toHaveBeenCalledWith(and(eq(events.slug, "launch-day"), eq(events.status, "published")));
  });

  it("returns undefined for a draft event's slug on the public (session-less) lookup", async () => {
    selectMock.mockReturnValue(selectChain([]));

    const result = await getPublishedEventBySlugPublic("draft-only-event");
    expect(result).toBeUndefined();
  });

  it("resolves a registration by its cancel token, for the self-cancel link landing page", async () => {
    const registration = { id: "reg-1", eventId: "event-1", cancelToken: "cancel-token-1", status: "confirmed" };
    const chain = selectChain([registration]);
    selectMock.mockReturnValue(chain);

    const result = await getRegistrationByCancelToken("cancel-token-1");

    expect(result).toEqual(registration);
    expect(chain.where).toHaveBeenCalledWith(eq(eventRegistrations.cancelToken, "cancel-token-1"));
  });

  it("returns undefined for an unknown cancel token", async () => {
    selectMock.mockReturnValue(selectChain([]));

    const result = await getRegistrationByCancelToken("unknown-token");
    expect(result).toBeUndefined();
  });
});

// Generic thenable chain for transaction-scoped mocks (tasks.md 3.3-3.8): awaitable at any point
// in the call chain (`.where()` alone, or further `.returning()`/`.limit()`), since
// registerForEvent/cancelRegistrationByToken await different points depending on the statement.
function txChain<T>(rows: T[]) {
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    values: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  for (const key of ["from", "innerJoin", "where", "orderBy", "limit", "values", "set"]) {
    (chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  }
  (chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue(rows);
  return chain;
}

// tasks.md 3.3-3.8 — registerForEvent: companions, capacity/waitlist, concurrency lock,
// duplicate-email mapping. design.md "Waitlist concurrency" / "Active-email uniqueness".
describe("events service — registerForEvent", () => {
  const unlimitedEvent = { ...baseEvent, status: "published" as const, capacity: null };

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ execute: txExecuteMock, select: txSelectMock, insert: txInsertMock, update: txUpdateMock }),
    );
  });

  it("confirms the primary attendee when the event has unlimited capacity", async () => {
    txSelectMock.mockReturnValueOnce(txChain([unlimitedEvent]));
    const registrationRow = { id: "reg-1", status: "confirmed" };
    const attendeeRow = { id: "att-1", email: "ada@example.com" };
    txInsertMock.mockReturnValueOnce(txChain([registrationRow])).mockReturnValueOnce(txChain([attendeeRow]));

    const result = await registerForEvent({
      eventId: "event-1",
      primary: { fullName: "Ada Lovelace", email: "ada@example.com" },
    });

    expect(result).toEqual({ ok: true, registration: registrationRow, attendees: [attendeeRow] });
    expect(txExecuteMock).toHaveBeenCalledTimes(1);
  });

  it("waitlists the whole group when confirmed seats would exceed capacity", async () => {
    const limitedEvent = { ...unlimitedEvent, capacity: 1 };
    txSelectMock
      .mockReturnValueOnce(txChain([limitedEvent]))
      .mockReturnValueOnce(txChain([{ seatsUsed: 1 }]));
    const registrationRow = { id: "reg-1", status: "waitlisted" };
    const attendeeRow = { id: "att-1", email: "ada@example.com" };
    txInsertMock.mockReturnValueOnce(txChain([registrationRow])).mockReturnValueOnce(txChain([attendeeRow]));

    const result = await registerForEvent({
      eventId: "event-1",
      primary: { fullName: "Ada Lovelace", email: "ada@example.com" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.registration.status).toBe("waitlisted");
  });

  it("returns event_not_found when the event id does not resolve", async () => {
    txSelectMock.mockReturnValueOnce(txChain([]));

    const result = await registerForEvent({
      eventId: "missing",
      primary: { fullName: "Ada Lovelace", email: "ada@example.com" },
    });

    expect(result).toEqual({ ok: false, reason: "event_not_found" });
    expect(txInsertMock).not.toHaveBeenCalled();
  });

  it("returns event_not_found for a draft event on the public source (draft never publicly reachable)", async () => {
    txSelectMock.mockReturnValueOnce(txChain([{ ...unlimitedEvent, status: "draft" }]));

    const result = await registerForEvent({
      eventId: "event-1",
      source: "public",
      primary: { fullName: "Ada Lovelace", email: "ada@example.com" },
    });

    expect(result).toEqual({ ok: false, reason: "event_not_found" });
  });

  it("allows admin_added registrations onto a draft event", async () => {
    txSelectMock.mockReturnValueOnce(txChain([{ ...unlimitedEvent, status: "draft" }]));
    const registrationRow = { id: "reg-1", status: "confirmed" };
    const attendeeRow = { id: "att-1" };
    txInsertMock.mockReturnValueOnce(txChain([registrationRow])).mockReturnValueOnce(txChain([attendeeRow]));

    const result = await registerForEvent({
      eventId: "event-1",
      source: "admin_added",
      primary: { fullName: "Staff Entry", email: "staff@example.com" },
    });

    expect(result.ok).toBe(true);
  });

  it("maps the active-email unique-violation to duplicate_email instead of rethrowing", async () => {
    txSelectMock.mockReturnValueOnce(txChain([unlimitedEvent]));
    const registrationRow = { id: "reg-1", status: "confirmed" };
    txInsertMock.mockReturnValueOnce(txChain([registrationRow])).mockImplementationOnce(() => {
      throw { code: "23505", constraint_name: "event_attendees_event_email_active_unique" };
    });

    const result = await registerForEvent({
      eventId: "event-1",
      primary: { fullName: "Ada Lovelace", email: "ada@example.com" },
    });

    expect(result).toEqual({ ok: false, reason: "duplicate_email" });
  });

  // Regression: live-tested, this crashed the page instead of showing the friendly message.
  // drizzle-orm's postgres-js driver actually throws a `DrizzleQueryError` wrapper whose OWN
  // `code`/`constraint_name` are undefined — the real Postgres fields live on `error.cause`.
  it("maps a wrapped (DrizzleQueryError-shaped) unique-violation to duplicate_email, reading error.cause", async () => {
    txSelectMock.mockReturnValueOnce(txChain([unlimitedEvent]));
    const registrationRow = { id: "reg-1", status: "confirmed" };
    txInsertMock.mockReturnValueOnce(txChain([registrationRow])).mockImplementationOnce(() => {
      throw {
        message: "Failed query: insert into ...",
        cause: { code: "23505", constraint_name: "event_attendees_event_email_active_unique" },
      };
    });

    const result = await registerForEvent({
      eventId: "event-1",
      primary: { fullName: "Ada Lovelace", email: "ada@example.com" },
    });

    expect(result).toEqual({ ok: false, reason: "duplicate_email" });
  });

  it("rethrows a unique-violation unrelated to the active-email index", async () => {
    txSelectMock.mockReturnValueOnce(txChain([unlimitedEvent]));
    const registrationRow = { id: "reg-1", status: "confirmed" };
    const otherError = { code: "23505", constraint_name: "event_attendees_event_backup_code_unique" };
    txInsertMock.mockReturnValueOnce(txChain([registrationRow])).mockImplementationOnce(() => {
      throw otherError;
    });

    await expect(
      registerForEvent({
        eventId: "event-1",
        primary: { fullName: "Ada Lovelace", email: "ada@example.com" },
      }),
    ).rejects.toBe(otherError);
  });

  it("rethrows a wrapped unique-violation unrelated to the active-email index", async () => {
    txSelectMock.mockReturnValueOnce(txChain([unlimitedEvent]));
    const registrationRow = { id: "reg-1", status: "confirmed" };
    const otherError = {
      message: "Failed query",
      cause: { code: "23505", constraint_name: "event_attendees_event_backup_code_unique" },
    };
    txInsertMock.mockReturnValueOnce(txChain([registrationRow])).mockImplementationOnce(() => {
      throw otherError;
    });

    await expect(
      registerForEvent({
        eventId: "event-1",
        primary: { fullName: "Ada Lovelace", email: "ada@example.com" },
      }),
    ).rejects.toBe(otherError);
  });
});

// Admin feedback round ("master form" to add more companions to an ALREADY-submitted
// registration): same per-event capacity lock as registerForEvent, but scoped to one existing
// registration — the new attendee joins that registration's existing status rather than deciding
// a fresh confirmed/waitlisted split.
describe("events service — addAttendeeToRegistration", () => {
  const confirmedRegistration = { id: "reg-1", eventId: "event-1", organizationId: "org-1", status: "confirmed" as const };
  const waitlistedRegistration = { ...confirmedRegistration, status: "waitlisted" as const };
  const cancelledRegistration = { ...confirmedRegistration, status: "cancelled" as const };

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ execute: txExecuteMock, select: txSelectMock, insert: txInsertMock, update: txUpdateMock }),
    );
  });

  it("returns registration_not_found when the registration doesn't exist in this organization", async () => {
    txSelectMock.mockReturnValueOnce(txChain([]));

    const result = await addAttendeeToRegistration({
      registrationId: "reg-1",
      organizationId: "org-1",
      attendee: { fullName: "Alan Turing", email: "alan@example.com" },
    });

    expect(result).toEqual({ ok: false, reason: "registration_not_found" });
    expect(txInsertMock).not.toHaveBeenCalled();
  });

  it("returns cancelled for a cancelled registration, without locking the event", async () => {
    txSelectMock.mockReturnValueOnce(txChain([cancelledRegistration]));

    const result = await addAttendeeToRegistration({
      registrationId: "reg-1",
      organizationId: "org-1",
      attendee: { fullName: "Alan Turing", email: "alan@example.com" },
    });

    expect(result).toEqual({ ok: false, reason: "cancelled" });
    expect(txExecuteMock).not.toHaveBeenCalled();
  });

  it("adds an attendee to a confirmed registration under capacity", async () => {
    const newAttendee = { id: "att-2", registrationId: "reg-1", fullName: "Alan Turing" };
    txSelectMock
      .mockReturnValueOnce(txChain([confirmedRegistration]))
      .mockReturnValueOnce(txChain([{ ...baseEvent, capacity: 10 }]))
      .mockReturnValueOnce(txChain([{ seatsUsed: 1 }]));
    txInsertMock.mockReturnValueOnce(txChain([newAttendee]));

    const result = await addAttendeeToRegistration({
      registrationId: "reg-1",
      organizationId: "org-1",
      attendee: { fullName: "Alan Turing", email: "alan@example.com" },
    });

    expect(result).toEqual({ ok: true, attendee: newAttendee, registrationStatus: "confirmed" });
  });

  it("rejects adding to a confirmed registration when the event is at capacity", async () => {
    txSelectMock
      .mockReturnValueOnce(txChain([confirmedRegistration]))
      .mockReturnValueOnce(txChain([{ ...baseEvent, capacity: 1 }]))
      .mockReturnValueOnce(txChain([{ seatsUsed: 1 }]));

    const result = await addAttendeeToRegistration({
      registrationId: "reg-1",
      organizationId: "org-1",
      attendee: { fullName: "Alan Turing", email: "alan@example.com" },
    });

    expect(result).toEqual({ ok: false, reason: "at_capacity" });
    expect(txInsertMock).not.toHaveBeenCalled();
  });

  it("adds an attendee to a waitlisted registration without checking capacity", async () => {
    const newAttendee = { id: "att-2", registrationId: "reg-1", fullName: "Alan Turing" };
    txSelectMock
      .mockReturnValueOnce(txChain([waitlistedRegistration]))
      .mockReturnValueOnce(txChain([{ ...baseEvent, capacity: 1 }]));
    txInsertMock.mockReturnValueOnce(txChain([newAttendee]));

    const result = await addAttendeeToRegistration({
      registrationId: "reg-1",
      organizationId: "org-1",
      attendee: { fullName: "Alan Turing", email: "alan@example.com" },
    });

    expect(result).toEqual({ ok: true, attendee: newAttendee, registrationStatus: "waitlisted" });
  });

  it("maps a duplicate-email violation to duplicate_email", async () => {
    txSelectMock
      .mockReturnValueOnce(txChain([confirmedRegistration]))
      .mockReturnValueOnce(txChain([{ ...baseEvent, capacity: null }]));
    txInsertMock.mockImplementationOnce(() => {
      throw { cause: { code: "23505", constraint_name: "event_attendees_event_email_active_unique" } };
    });

    const result = await addAttendeeToRegistration({
      registrationId: "reg-1",
      organizationId: "org-1",
      attendee: { fullName: "Alan Turing", email: "alan@example.com" },
    });

    expect(result).toEqual({ ok: false, reason: "duplicate_email" });
  });
});

// tasks.md 3.10 — cancelRegistrationByToken: invalid/unknown token is a no-op, a cancelled
// registration is idempotent, and cancelling a confirmed registration promotes exactly the oldest
// waitlisted one (design.md "Waitlist concurrency").
describe("events service — cancelRegistrationByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ execute: txExecuteMock, select: txSelectMock, insert: txInsertMock, update: txUpdateMock }),
    );
  });

  it("returns invalid_token when no registration matches the cancel token", async () => {
    txSelectMock.mockReturnValueOnce(txChain([]));

    const result = await cancelRegistrationByToken("unknown-token");

    expect(result).toEqual({ ok: false, reason: "invalid_token" });
    expect(txExecuteMock).not.toHaveBeenCalled();
  });

  it("returns already_cancelled without re-locking or re-cancelling", async () => {
    txSelectMock.mockReturnValueOnce(
      txChain([{ id: "reg-1", eventId: "event-1", status: "cancelled" }]),
    );

    const result = await cancelRegistrationByToken("cancel-token-1");

    expect(result).toEqual({ ok: false, reason: "already_cancelled" });
    expect(txExecuteMock).not.toHaveBeenCalled();
    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  it("cancels a waitlisted registration and does not look for anyone to promote", async () => {
    const cancelledRow = { id: "reg-1", eventId: "event-1", status: "cancelled" };
    txSelectMock.mockReturnValueOnce(
      txChain([{ id: "reg-1", eventId: "event-1", status: "waitlisted" }]),
    );
    txUpdateMock
      .mockReturnValueOnce(txChain([cancelledRow]))
      .mockReturnValueOnce(txChain([]));

    const result = await cancelRegistrationByToken("cancel-token-1");

    expect(result).toEqual({ ok: true, registration: cancelledRow });
    expect(txSelectMock).toHaveBeenCalledTimes(1);
  });

  it("cancels a confirmed registration and promotes the oldest waitlisted one", async () => {
    const cancelledRow = { id: "reg-1", eventId: "event-1", status: "cancelled" };
    const oldestWaitlisted = { id: "reg-2", eventId: "event-1", status: "waitlisted" };
    const promotedRow = { id: "reg-2", eventId: "event-1", status: "confirmed" };
    const promotedAttendees = [{ id: "att-2", email: "alan@example.com" }];

    txSelectMock
      .mockReturnValueOnce(txChain([{ id: "reg-1", eventId: "event-1", status: "confirmed" }]))
      .mockReturnValueOnce(txChain([oldestWaitlisted]))
      .mockReturnValueOnce(txChain(promotedAttendees));
    txUpdateMock
      .mockReturnValueOnce(txChain([cancelledRow]))
      .mockReturnValueOnce(txChain([]))
      .mockReturnValueOnce(txChain([promotedRow]));

    const result = await cancelRegistrationByToken("cancel-token-1");

    expect(result).toEqual({
      ok: true,
      registration: cancelledRow,
      promoted: { registration: promotedRow, attendees: promotedAttendees },
    });
  });

  it("cancels a confirmed registration with nobody left on the waitlist to promote", async () => {
    const cancelledRow = { id: "reg-1", eventId: "event-1", status: "cancelled" };
    txSelectMock
      .mockReturnValueOnce(txChain([{ id: "reg-1", eventId: "event-1", status: "confirmed" }]))
      .mockReturnValueOnce(txChain([]));
    txUpdateMock.mockReturnValueOnce(txChain([cancelledRow])).mockReturnValueOnce(txChain([]));

    const result = await cancelRegistrationByToken("cancel-token-1");

    expect(result).toEqual({ ok: true, registration: cancelledRow });
  });
});

// Service-layer primitives needed before any CRUD/registration logic lands (tasks.md 1.8):
// backup-code alphabet/length, opaque pass/cancel tokens, and email normalization used by the
// partial unique index on event_attendees.
describe("events service — backup codes", () => {
  it("uses the 32-char Crockford base32 alphabet, excluding I/L/O/U", () => {
    expect(CROCKFORD_BASE32_ALPHABET).toHaveLength(32);
    for (const excluded of ["I", "L", "O", "U"]) {
      expect(CROCKFORD_BASE32_ALPHABET).not.toContain(excluded);
    }
  });

  it("generates an 8-character code drawn only from the Crockford alphabet", () => {
    const code = generateBackupCode();
    expect(code).toHaveLength(8);
    for (const char of code) {
      expect(CROCKFORD_BASE32_ALPHABET).toContain(char);
    }
  });

  it("generates different codes across calls (collision-regeneration precondition)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateBackupCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("events service — opaque tokens", () => {
  it("generates a URL-safe base64 token with no padding or reserved characters", () => {
    const token = generateOpaqueToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("generates different tokens across calls", () => {
    expect(generateOpaqueToken()).not.toBe(generateOpaqueToken());
  });
});

describe("events service — email normalization", () => {
  it("lowercases and trims the email", () => {
    expect(normalizeEmail("  Someone@Example.COM  ")).toBe("someone@example.com");
  });

  it("is stable under repeated normalization", () => {
    const once = normalizeEmail("Person@Domain.com");
    expect(normalizeEmail(once)).toBe(once);
  });
});

// tasks.md 4.1/4.2 — check-in by pass_token or backup_code, scoped to the event the staff member
// is checking people into; re-scan is idempotent (no mutation, returns the prior timestamp).
describe("events service — checkInAttendee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found when neither pass_token nor backup_code is given", async () => {
    const result = await checkInAttendee({ eventId: "event-1", checkedInBy: "staff-1" });

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("returns not_found when no attendee matches the pass token for this event", async () => {
    selectMock.mockReturnValue(selectChain([]));

    const result = await checkInAttendee({
      eventId: "event-1",
      passToken: "unknown-token",
      checkedInBy: "staff-1",
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("checks in an attendee by pass token and flips the registration to checked_in", async () => {
    const attendee = {
      id: "att-1",
      eventId: "event-1",
      registrationId: "reg-1",
      passToken: "pass-token-1",
      checkedInAt: null,
    };
    const checkedInAttendee = { ...attendee, checkedInAt: new Date("2026-11-01T18:05:00Z"), checkedInBy: "staff-1" };
    selectMock.mockReturnValueOnce(selectChain([attendee]));
    updateMock
      .mockReturnValueOnce(updateChain([checkedInAttendee]))
      .mockReturnValueOnce(updateChain([{ id: "reg-1", status: "checked_in" }]));

    const result = await checkInAttendee({
      eventId: "event-1",
      passToken: "pass-token-1",
      checkedInBy: "staff-1",
    });

    expect(result).toEqual({ ok: true, attendee: checkedInAttendee, alreadyCheckedIn: false });
    expect(updateMock).toHaveBeenCalledTimes(2);
  });

  it("checks in an attendee by backup code scoped to the event", async () => {
    const attendee = {
      id: "att-1",
      eventId: "event-1",
      registrationId: "reg-1",
      backupCode: "ABCD1234",
      checkedInAt: null,
    };
    const checkedInAttendee = { ...attendee, checkedInAt: new Date(), checkedInBy: "staff-1" };
    const chain = selectChain([attendee]);
    selectMock.mockReturnValueOnce(chain);
    updateMock
      .mockReturnValueOnce(updateChain([checkedInAttendee]))
      .mockReturnValueOnce(updateChain([{ id: "reg-1", status: "checked_in" }]));

    await checkInAttendee({ eventId: "event-1", backupCode: "ABCD1234", checkedInBy: "staff-1" });

    expect(chain.where).toHaveBeenCalledWith(
      and(eq(eventAttendees.eventId, "event-1"), eq(eventAttendees.backupCode, "ABCD1234")),
    );
  });

  it("is idempotent on re-scan: returns the prior timestamp without mutating anything", async () => {
    const alreadyCheckedIn = {
      id: "att-1",
      eventId: "event-1",
      registrationId: "reg-1",
      passToken: "pass-token-1",
      checkedInAt: new Date("2026-11-01T18:00:00Z"),
      checkedInBy: "staff-0",
    };
    selectMock.mockReturnValueOnce(selectChain([alreadyCheckedIn]));

    const result = await checkInAttendee({
      eventId: "event-1",
      passToken: "pass-token-1",
      checkedInBy: "staff-1",
    });

    expect(result).toEqual({ ok: true, attendee: alreadyCheckedIn, alreadyCheckedIn: true });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

// tasks.md 4.3 — reminder-due arithmetic as a pure function (design.md "Testing Strategy"),
// separated from the query so the window logic is testable without a real clock/SQL interval.
describe("events service — isReminderDue", () => {
  const startsAt = new Date("2026-11-01T18:00:00Z");

  it("is not due more than the offset before the start time", () => {
    const now = new Date("2026-11-01T16:00:00Z"); // 2h before, offset is 60min
    expect(isReminderDue(now, startsAt, 60)).toBe(false);
  });

  it("is due exactly at the offset window and up to the start time", () => {
    const atWindowOpen = new Date("2026-11-01T17:00:00Z"); // exactly 60min before
    const justBeforeStart = new Date("2026-11-01T17:59:00Z");
    expect(isReminderDue(atWindowOpen, startsAt, 60)).toBe(true);
    expect(isReminderDue(justBeforeStart, startsAt, 60)).toBe(true);
  });

  it("is no longer due once the event has started", () => {
    const afterStart = new Date("2026-11-01T18:00:00Z");
    expect(isReminderDue(afterStart, startsAt, 60)).toBe(false);
  });
});

// tasks.md 4.3 — the reminder webhook's data source: confirmed, active attendees of a published
// event whose reminder window is open right now.
describe("events service — listDueReminderAttendees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only attendees whose event's reminder window is currently open", async () => {
    const now = new Date("2026-11-01T17:30:00Z");
    const dueEvent = { ...baseEvent, id: "event-due", status: "published" as const, startsAt: new Date("2026-11-01T18:00:00Z"), reminderOffsetMinutes: 60 };
    const notYetDueEvent = { ...baseEvent, id: "event-not-due", status: "published" as const, startsAt: new Date("2026-11-03T18:00:00Z"), reminderOffsetMinutes: 60 };
    const attendeeDue = { id: "att-1", eventId: "event-due" };
    const attendeeNotDue = { id: "att-2", eventId: "event-not-due" };
    selectMock.mockReturnValue(
      selectChain([
        { event: dueEvent, attendee: attendeeDue },
        { event: notYetDueEvent, attendee: attendeeNotDue },
      ]),
    );

    const result = await listDueReminderAttendees(now);

    expect(result).toEqual([{ event: dueEvent, attendee: attendeeDue }]);
  });

  it("excludes events with no reminder configured", async () => {
    const now = new Date("2026-11-01T17:30:00Z");
    const noReminderEvent = { ...baseEvent, id: "event-x", status: "published" as const, startsAt: new Date("2026-11-01T18:00:00Z"), reminderOffsetMinutes: null };
    selectMock.mockReturnValue(
      selectChain([{ event: noReminderEvent, attendee: { id: "att-1", eventId: "event-x" } }]),
    );

    const result = await listDueReminderAttendees(now);
    expect(result).toEqual([]);
  });
});

// tasks.md 5.5 — the dashboard's "visits" counter (design.md Open Questions, resolved in PR5):
// a plain increment on `events.visit_count`, never a write into `tracking_events`.
describe("events service — recordEventVisit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments the visit counter for a published event by slug", async () => {
    const chain = updateChain([]);
    updateMock.mockReturnValue(chain);

    await recordEventVisit("launch-day");

    expect(updateMock).toHaveBeenCalledWith(events);
    expect(chain.where).toHaveBeenCalledWith(
      and(eq(events.slug, "launch-day"), eq(events.status, "published")),
    );
  });
});

// tasks.md 5.1/5.2 — registrations admin: scoped to event+organization, optional status filter,
// attendees (companions/contact/pass status) joined back onto each registration.
describe("events service — listRegistrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists registrations scoped to the event/org with their attendees joined", async () => {
    const registration = {
      id: "reg-1",
      eventId: "event-1",
      organizationId: "org-1",
      status: "confirmed",
      createdAt: new Date("2026-10-01T00:00:00Z"),
    };
    const attendee = { id: "att-1", registrationId: "reg-1", fullName: "Ada Lovelace" };
    selectMock
      .mockReturnValueOnce(selectChain([registration]))
      .mockReturnValueOnce(selectChain([attendee]));

    const result = await listRegistrations("event-1", "org-1");

    expect(result).toEqual([{ ...registration, attendees: [attendee] }]);
  });

  it("filters by status when given", async () => {
    const chain = selectChain([]);
    selectMock.mockReturnValueOnce(chain);

    await listRegistrations("event-1", "org-1", { status: "waitlisted" });

    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(eventRegistrations.eventId, "event-1"),
        eq(eventRegistrations.organizationId, "org-1"),
        eq(eventRegistrations.status, "waitlisted"),
      ),
    );
  });

  it("returns an empty array without querying attendees when there are no registrations", async () => {
    selectMock.mockReturnValueOnce(selectChain([]));

    const result = await listRegistrations("event-1", "org-1");

    expect(result).toEqual([]);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it("filters by a free-text query matched against any attendee's name or email", async () => {
    const registrationA = { id: "reg-a", eventId: "event-1", organizationId: "org-1", status: "confirmed" };
    const registrationB = { id: "reg-b", eventId: "event-1", organizationId: "org-1", status: "confirmed" };
    const attendeeA = { id: "att-a", registrationId: "reg-a", fullName: "Ada Lovelace", email: "ada@example.com" };
    const attendeeB = { id: "att-b", registrationId: "reg-b", fullName: "Alan Turing", email: "alan@example.com" };
    selectMock
      .mockReturnValueOnce(selectChain([registrationA, registrationB]))
      .mockReturnValueOnce(selectChain([attendeeA, attendeeB]));

    const result = await listRegistrations("event-1", "org-1", { q: "ada" });

    expect(result).toEqual([{ ...registrationA, attendees: [attendeeA] }]);
  });
});

// tasks.md 5.5/5.6 — ADMIN-only per-event dashboard numbers.
describe("events service — getEventInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined when the event is not found or outside the organization", async () => {
    selectMock.mockReturnValueOnce(selectChain([]));

    const result = await getEventInsights("event-1", "org-1");
    expect(result).toBeUndefined();
  });

  it("computes visits/registrations/attendance/conversion", async () => {
    const event = { ...baseEvent, visitCount: 100 };
    selectMock
      .mockReturnValueOnce(selectChain([event]))
      .mockReturnValueOnce(selectChain([{ total: 40 }]))
      .mockReturnValueOnce(selectChain([{ total: 10 }]));

    const result = await getEventInsights("event-1", "org-1");

    expect(result).toEqual({ visits: 100, registrations: 40, attendance: 10, conversion: 0.4 });
  });

  it("returns a null conversion (not 0) when there have been no visits yet", async () => {
    const event = { ...baseEvent, visitCount: 0 };
    selectMock
      .mockReturnValueOnce(selectChain([event]))
      .mockReturnValueOnce(selectChain([{ total: 0 }]))
      .mockReturnValueOnce(selectChain([{ total: 0 }]));

    const result = await getEventInsights("event-1", "org-1");
    expect(result?.conversion).toBeNull();
  });
});

// Admin feedback round ("poder generar un webhook por evento") — admin supplies the destination
// URL, we generate the signing secret exactly once (the first time a URL is saved with no secret
// yet), never silently regenerating it on every edit.
describe("events service — setEventWebhookUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies a non-admin without updating anything", async () => {
    const result = await setEventWebhookUrl({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "MARKETING_USER",
      webhookUrl: "https://example.com/webhook",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(selectMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("generates a secret when setting a URL for the first time (no existing secret)", async () => {
    selectMock.mockReturnValue(selectChain([{ ...baseEvent, webhookUrl: null, webhookSecret: null }]));
    const updated = { ...baseEvent, webhookUrl: "https://example.com/webhook", webhookSecret: "generated-secret" };
    const chain = updateChain([updated]);
    updateMock.mockReturnValue(chain);

    const result = await setEventWebhookUrl({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
      webhookUrl: "https://example.com/webhook",
    });

    expect(result).toEqual({ ok: true, event: updated });
    const setCall = chain.set.mock.calls[0][0];
    expect(setCall.webhookUrl).toBe("https://example.com/webhook");
    expect(typeof setCall.webhookSecret).toBe("string");
    expect(setCall.webhookSecret.length).toBeGreaterThan(20);
  });

  it("keeps the existing secret when a URL is changed but a secret already exists", async () => {
    selectMock.mockReturnValue(
      selectChain([{ ...baseEvent, webhookUrl: "https://old.example.com", webhookSecret: "existing-secret" }]),
    );
    const chain = updateChain([{ ...baseEvent, webhookSecret: "existing-secret" }]);
    updateMock.mockReturnValue(chain);

    await setEventWebhookUrl({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
      webhookUrl: "https://new.example.com",
    });

    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ webhookUrl: "https://new.example.com", webhookSecret: "existing-secret" }),
    );
  });

  it("returns not_found when the event doesn't exist in this organization", async () => {
    selectMock.mockReturnValue(selectChain([]));

    const result = await setEventWebhookUrl({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
      webhookUrl: "https://example.com/webhook",
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("events service — regenerateEventWebhookSecret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies a non-admin without updating anything", async () => {
    const result = await regenerateEventWebhookSecret({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "VIEWER",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sets a fresh secret for ADMIN", async () => {
    const updated = { ...baseEvent, webhookSecret: "fresh-secret" };
    const chain = updateChain([updated]);
    updateMock.mockReturnValue(chain);

    const result = await regenerateEventWebhookSecret({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
    });

    expect(result).toEqual({ ok: true, event: updated });
    const setCall = chain.set.mock.calls[0][0];
    expect(typeof setCall.webhookSecret).toBe("string");
    expect(setCall.webhookSecret.length).toBeGreaterThan(20);
  });

  it("returns not_found when the event doesn't exist in this organization", async () => {
    updateMock.mockReturnValue(updateChain([]));

    const result = await regenerateEventWebhookSecret({
      id: "event-1",
      organizationId: "org-1",
      actorRole: "ADMIN",
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("events service — notifyEventWebhook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("does nothing when the event has no webhook configured", async () => {
    await notifyEventWebhook({ webhookUrl: null, webhookSecret: null }, "registration.created", { id: "reg-1" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("POSTs the payload with the secret header when a webhook is configured", async () => {
    await notifyEventWebhook(
      { webhookUrl: "https://example.com/webhook", webhookSecret: "my-secret" },
      "registration.created",
      { id: "reg-1" },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-webhook-secret": "my-secret" }),
      }),
    );
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toMatchObject({ type: "registration.created", data: { id: "reg-1" } });
  });

  it("swallows a fetch failure instead of throwing (fire-and-forget)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(
      notifyEventWebhook({ webhookUrl: "https://example.com/webhook", webhookSecret: "s" }, "registration.created", {}),
    ).resolves.toBeUndefined();
  });
});
