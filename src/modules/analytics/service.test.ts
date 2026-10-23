import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  insertCalls: [] as ReturnType<typeof vi.fn>[],
}));

vi.mock("@/db/client", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/modules/qr", () => ({ getQrCode: vi.fn() }));

import { trackRedirect } from "./service";

function input(consentGranted: boolean) {
  return {
    organizationId: "org-1",
    linkId: "link-1",
    shortLinkId: "short-1",
    sourceType: "qr_scan" as const,
    visitorHash: "visitor-hash",
    userAgent: "Mozilla/5.0",
    consentGranted,
  };
}

describe("trackRedirect persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.insertCalls.length = 0;
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => {
      const insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) });
      mocks.insertCalls.push(insert);
      await callback({ insert });
    });
  });

  it("persists the local event and consented GA4 outbox row atomically", async () => {
    await trackRedirect(input(true));

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.insertCalls[0]).toHaveBeenCalledTimes(2);
  });

  it("persists local analytics without creating an outbox row without consent", async () => {
    await trackRedirect(input(false));

    expect(mocks.insertCalls[0]).toHaveBeenCalledOnce();
  });
});
