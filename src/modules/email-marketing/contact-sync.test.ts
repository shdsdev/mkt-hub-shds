import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: { insert: insertMock } }));

import { syncEventAttendeeContact } from "./service";

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

describe("syncEventAttendeeContact", () => {
  beforeEach(() => vi.resetAllMocks());

  it("upserts one global contact and its event membership", async () => {
    const contact = { id: "contact-1" };
    const contactChain = contactInsertChain(contact);
    const membershipChain = membershipInsertChain();
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
    ).resolves.toEqual({ contactId: "contact-1" });

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
});
