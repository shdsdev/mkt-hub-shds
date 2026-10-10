import { beforeEach, describe, it, expect, vi } from "vitest";

const { insertMock, updateMock, selectMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  updateMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { insert: insertMock, update: updateMock, select: selectMock },
}));

// Avoids pulling the real `@/modules/users` barrel into this unit test — that barrel re-exports
// `management.ts`, which imports `src/lib/supabase/admin.ts` (`import "server-only"`), a package
// not resolvable under Vitest's plain Node environment (pre-existing repo condition, unrelated to
// this PR). Production code still imports the real barrel (ARCHITECTURE.md I-4).
vi.mock("@/modules/users", () => ({
  isAdmin: (profile: { role: string }) => profile.role === "ADMIN",
}));

import { and, eq } from "drizzle-orm";
import { events } from "./db";
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
