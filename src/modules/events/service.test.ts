import { beforeEach, describe, it, expect, vi } from "vitest";

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
import { events, eventRegistrations } from "./db";
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
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  chain.from.mockReturnValue(chain);
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
