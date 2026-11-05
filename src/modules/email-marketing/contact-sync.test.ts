import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock, selectMock, executeMock, transactionMock, rootInsertMock, rootSelectMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  executeMock: vi.fn(),
  transactionMock: vi.fn(),
  rootInsertMock: vi.fn(),
  rootSelectMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: { insert: rootInsertMock, select: rootSelectMock, transaction: transactionMock } }));

import { syncEventAttendeeContact } from "./service";
import { PgDialect } from "drizzle-orm/pg-core";

function contactInsertChain(row: unknown) {
  const chain = { values: vi.fn(), onConflictDoUpdate: vi.fn(), returning: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoUpdate.mockReturnValue(chain);
  chain.returning.mockResolvedValue(row ? [row] : []);
  return chain;
}

function membershipInsertChain() {
  const chain = { values: vi.fn(), onConflictDoUpdate: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoUpdate.mockResolvedValue(undefined);
  return chain;
}

function emptySelectChain(rows: unknown[] = []) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue(rows);
  return chain;
}

describe("syncEventAttendeeContact", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ insert: insertMock, select: selectMock, execute: executeMock }),
    );
    executeMock.mockResolvedValue([{ id: "attendee-1" }]);
  });

  it("upserts one global contact and its event membership", async () => {
    const contact = { id: "contact-1" };
    const contactChain = contactInsertChain(contact);
    const membershipChain = membershipInsertChain();
    selectMock.mockReturnValue(emptySelectChain());
    insertMock.mockReturnValueOnce(contactChain).mockReturnValueOnce(membershipChain);

    await expect(
      syncEventAttendeeContact({
        organizationId: "org-1",
        eventId: "event-1",
        attendeeId: "attendee-1",
        email: " Customer@Example.COM ",
        fullName: "Customer Example",
        marketingAcceptedAt: new Date("2026-10-22T10:00:00.000Z"),
        attributes: { interests: ["automation"] },
      }),
    ).resolves.toEqual({ contactId: "contact-1", created: true });
    expect(transactionMock).toHaveBeenCalledOnce();
    expect(rootInsertMock).not.toHaveBeenCalled();
    expect(rootSelectMock).not.toHaveBeenCalled();
    expect(executeMock.mock.invocationCallOrder[1]).toBeLessThan(selectMock.mock.invocationCallOrder[0]);
    const dialect = new PgDialect();
    const lock = dialect.sqlToQuery(executeMock.mock.calls[0][0]);
    expect(lock.sql).toContain("from events");
    expect(lock.sql).toContain("for update");
    expect(lock.params).toEqual(["event-1", "org-1"]);
    const attendeeCheck = dialect.sqlToQuery(executeMock.mock.calls[1][0]);
    expect(attendeeCheck.sql).toContain("join event_registrations");
    expect(attendeeCheck.sql).toContain("r.id = a.registration_id");
    expect(attendeeCheck.sql).toContain("a.event_id = r.event_id");
    expect(attendeeCheck.sql).toContain("a.organization_id = r.organization_id");
    expect(attendeeCheck.params).toEqual(["attendee-1", "event-1", "org-1"]);

    expect(contactChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        emailNormalized: "customer@example.com",
        subscriptionStatus: "subscribed",
      }),
    );
    expect(membershipChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        contactId: "contact-1",
        eventId: "event-1",
        attendeeId: "attendee-1",
      }),
    );
  });

  it("fails when the database cannot return the upserted contact", async () => {
    const contactChain = contactInsertChain(undefined);
    selectMock.mockReturnValue(emptySelectChain());
    insertMock.mockReturnValue(contactChain);

    await expect(
      syncEventAttendeeContact({
        organizationId: "org-1",
        eventId: "event-1",
        attendeeId: "attendee-1",
        email: "customer@example.com",
        fullName: "Customer Example",
      }),
    ).rejects.toThrow("Could not persist email marketing contact.");
  });

  it.each(["deleted attendee", "wrong event", "wrong organization", "missing registration"])("rejects %s before touching contacts", async () => {
    executeMock.mockResolvedValueOnce([{ id: "event-1" }]).mockResolvedValueOnce([]);
    await expect(syncEventAttendeeContact({ organizationId: "org-1", eventId: "event-1", attendeeId: "attendee-1",
      email: "customer@example.com", fullName: "Customer Example" }))
      .rejects.toThrow("Event attendee no longer exists in this organization and event.");
    expect(selectMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("waits for the event lock before verifying the attendee or reading contacts", async () => {
    let release!: () => void;
    executeMock.mockImplementationOnce(() => new Promise<Array<{ id: string }>>((resolve) => { release = () => resolve([{ id: "event-1" }]); }))
      .mockResolvedValueOnce([]);
    const pending = syncEventAttendeeContact({ organizationId: "org-1", eventId: "event-1", attendeeId: "attendee-1",
      email: "customer@example.com", fullName: "Customer Example" });
    expect(executeMock).toHaveBeenCalledOnce();
    expect(selectMock).not.toHaveBeenCalled();
    release();
    await expect(pending).rejects.toThrow("Event attendee no longer exists");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("preserves manually maintained fields and newer observations inside the transaction", async () => {
    const contactChain = contactInsertChain({ id: "contact-1" });
    selectMock.mockReturnValueOnce(emptySelectChain([{ id: "contact-1", fullName: "Manual Name", phone: "newer-phone",
      company: "Old Company", manualFields: ["fullName"], fieldUpdatedAt: { phone: "2026-11-05T00:00:00Z" },
      attributes: { retained: true } }])).mockReturnValueOnce(emptySelectChain([{ attributesSnapshot: { existing: true } }]));
    const membershipChain = membershipInsertChain();
    insertMock.mockReturnValueOnce(contactChain).mockReturnValueOnce(membershipChain);
    await expect(syncEventAttendeeContact({ organizationId: "org-1", eventId: "event-1", attendeeId: "attendee-1",
      email: "customer@example.com", fullName: "Stale Name", phone: "old-phone", company: "New Company",
      registrationObservedAt: "2026-11-01T00:00:00Z", attributes: { extra: true } }))
      .resolves.toEqual({ contactId: "contact-1", created: false });
    expect(contactChain.values).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Manual Name", phone: "newer-phone",
      company: "New Company", manualFields: ["fullName"], attributes: { retained: true, extra: true } }));
    expect(membershipChain.values).toHaveBeenCalledWith(expect.objectContaining({
      attributesSnapshot: { existing: true, extra: true, registrationStatus: null, registrationSource: null },
    }));
  });
});
