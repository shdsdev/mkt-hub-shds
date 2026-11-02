import { describe, expect, it, vi } from "vitest";

const contact = {
  id: "contact-1",
  email: "customer@example.com",
  fullName: "Customer",
  subscriptionStatus: "subscribed",
};

const query = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: query,
}));

import {
  normalizeContactEmail,
  preserveContactStatus,
  resolveInitialContactStatus,
  isAdminSubscriptionEligible,
  getCampaignRecipientContacts,
  saveEmailCampaignWithSnapshot,
} from "./service";

describe("email marketing contact policy", () => {
  it("normalizes email addresses for organization-scoped identity", () => {
    expect(normalizeContactEmail("  Customer@Example.COM ")).toBe("customer@example.com");
  });

  it("rejects invalid email addresses", () => {
    expect(() => normalizeContactEmail("not-an-email")).toThrow();
  });

  it("subscribes a contact when registration includes marketing consent", () => {
    expect(resolveInitialContactStatus(new Date("2026-10-22T10:00:00.000Z"))).toBe("subscribed");
  });

  it("keeps a contact pending without marketing consent", () => {
    expect(resolveInitialContactStatus(undefined)).toBe("pending");
  });

  it("never silently re-subscribes an unsubscribed contact", () => {
    expect(
      preserveContactStatus("unsubscribed", new Date("2026-10-22T10:00:00.000Z")),
    ).toBe("unsubscribed");
  });

  it("never silently re-subscribes a suppressed contact", () => {
    expect(
      preserveContactStatus("suppressed", new Date("2026-10-22T10:00:00.000Z")),
    ).toBe("suppressed");
  });

  it.each([
    ["pending", true],
    ["subscribed", false],
    ["unsubscribed", false],
    ["suppressed", false],
  ] as const)("only allows explicit admin subscription for %s contacts", (status, expected) => {
    expect(isAdminSubscriptionEligible(status)).toBe(expected);
  });

  it("returns eligible contacts for the campaign snapshot", async () => {
    const builder = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([contact]),
    };
    query.select.mockReturnValue(builder);

    await expect(
      getCampaignRecipientContacts({ organizationId: "org-1", campaignId: "campaign-1" }),
    ).resolves.toEqual([contact]);
  });

  it("returns the scheduled campaign after scheduling inside the transaction", async () => {
    const draftCampaign = { id: "campaign-1", status: "draft" };
    const scheduledCampaign = { ...draftCampaign, status: "scheduled" };
    let updateCount = 0;
    const update = vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updateCount++ === 0 ? draftCampaign : scheduledCampaign]),
    }));
    const tx = {
      update,
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      insert: vi.fn(() => ({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([draftCampaign]),
      })),
    };
    query.transaction.mockImplementation((callback) => callback(tx));

    await expect(
      saveEmailCampaignWithSnapshot({
        organizationId: "org-1",
        createdBy: "user-1",
        campaignId: "campaign-1",
        name: "Campaign",
        subject: "Subject",
        content: { mode: "blocks", blocks: [] } as never,
        htmlSnapshot: "<p>Content</p>",
        segmentId: null,
        scheduledAt: new Date("2026-11-03T12:00:00Z"),
        contacts: [contact] as never,
      }),
    ).resolves.toMatchObject({ campaign: scheduledCampaign, recipientCount: 1 });
  });
});
