import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock, selectMock, updateMock } = vi.hoisted(() => ({ insertMock: vi.fn(), selectMock: vi.fn(), updateMock: vi.fn() }));

vi.mock("@/db/client", () => ({ db: { insert: insertMock, select: selectMock, update: updateMock } }));
vi.mock("@/lib/env", () => ({ env: { MARKETING_HUB_SERVER_TOKEN: "test-token" } }));

import { createEmailContact, subscribeEmailContacts } from "./service";

describe("email contact management", () => {
  beforeEach(() => vi.resetAllMocks());

  it("creates a pending manual contact and preserves status on duplicate updates", async () => {
    const chain = { values: vi.fn(), onConflictDoUpdate: vi.fn(), returning: vi.fn() };
    chain.values.mockReturnValue(chain);
    chain.onConflictDoUpdate.mockReturnValue(chain);
    chain.returning.mockResolvedValue([{ id: "contact-1" }]);
    insertMock.mockReturnValue(chain);
    const selectChain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
    selectChain.from.mockReturnValue(selectChain);
    selectChain.where.mockReturnValue(selectChain);
    selectChain.limit.mockResolvedValue([]);
    selectMock.mockReturnValue(selectChain);

    await expect(createEmailContact({
      organizationId: "org-1",
      email: " Customer@Example.COM ",
      fullName: "Customer Example",
      source: "manual",
    })).resolves.toEqual({ contactId: "contact-1", created: true });

    expect(chain.values).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      emailNormalized: "customer@example.com",
      subscriptionStatus: "pending",
      source: "manual",
    }));
    expect(chain.onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      set: expect.not.objectContaining({ subscriptionStatus: expect.anything() }),
    }));
  });

  it("subscribes only eligible contacts in the organization", async () => {
    const chain = { set: vi.fn(), where: vi.fn(), returning: vi.fn() };
    chain.set.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.returning.mockResolvedValue([{ id: "contact-1" }]);
    updateMock.mockReturnValue(chain);
    const selectChain = { from: vi.fn(), where: vi.fn() };
    selectChain.from.mockReturnValue(selectChain);
    selectChain.where.mockResolvedValue([
      { id: "contact-1", status: "pending" },
      { id: "contact-2", status: "unsubscribed" },
      { id: "contact-3", status: "suppressed" },
    ]);
    selectMock.mockReturnValue(selectChain);

    const count = await subscribeEmailContacts({ organizationId: "org-1", contactIds: ["contact-1", "contact-2", "contact-3"] });

    expect(count).toBe(1);
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({
      subscriptionStatus: "subscribed",
      consentSource: "bulk_admin_action",
    }));
  });

  it("persists evidence-backed subscription data from an import", async () => {
    const chain = { values: vi.fn(), onConflictDoUpdate: vi.fn(), returning: vi.fn() };
    chain.values.mockReturnValue(chain);
    chain.onConflictDoUpdate.mockReturnValue(chain);
    chain.returning.mockResolvedValue([{ id: "contact-1" }]);
    insertMock.mockReturnValue(chain);
    const selectChain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
    selectChain.from.mockReturnValue(selectChain);
    selectChain.where.mockReturnValue(selectChain);
    selectChain.limit.mockResolvedValue([]);
    selectMock.mockReturnValue(selectChain);

    await createEmailContact({
      organizationId: "org-1",
      email: "customer@example.com",
      source: "csv_import",
      subscriptionStatus: "subscribed",
      consentSource: "purchase_tc",
      consentedAt: "2026-01-15T12:00:00.000Z",
    });

    expect(chain.values).toHaveBeenCalledWith(expect.objectContaining({
      subscriptionStatus: "subscribed",
      consentSource: "purchase_tc",
      consentedAt: new Date("2026-01-15T12:00:00.000Z"),
    }));
  });
});
