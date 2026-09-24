import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { select: mocks.select },
}));

import { countEventsForQrCodes } from "./service";

describe("countEventsForQrCodes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.where.mockReturnValue({ groupBy: mocks.groupBy });
  });

  it("maps grouped link scan counts to every dynamic QR and zero-fills missing or static rows", async () => {
    mocks.groupBy.mockResolvedValue([
      { linkId: "link-shared", count: 8 },
      { linkId: "link-other", count: 3 },
    ]);

    const counts = await countEventsForQrCodes([
      { id: "qr-one", linkId: "link-shared" },
      { id: "qr-two", linkId: "link-shared" },
      { id: "qr-three", linkId: "link-other" },
      { id: "qr-zero", linkId: "link-without-events" },
      { id: "qr-static", linkId: null },
    ]);

    expect(Object.fromEntries(counts)).toEqual({
      "qr-one": 8,
      "qr-two": 8,
      "qr-three": 3,
      "qr-zero": 0,
      "qr-static": 0,
    });
    expect(mocks.groupBy).toHaveBeenCalledTimes(1);
  });

  it("does not query tracking events when every QR is static", async () => {
    const counts = await countEventsForQrCodes([{ id: "qr-static", linkId: null }]);

    expect(Object.fromEntries(counts)).toEqual({ "qr-static": 0 });
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
