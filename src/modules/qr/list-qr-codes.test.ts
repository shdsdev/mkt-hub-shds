import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  listFrom: vi.fn(),
  listLeftJoin: vi.fn(),
  listWhere: vi.fn(),
  listOrderBy: vi.fn(),
  listLimit: vi.fn(),
  listOffset: vi.fn(),
  countFrom: vi.fn(),
  countLeftJoin: vi.fn(),
  countWhere: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { select: mocks.select },
}));

import { listQrCodes } from "./service";

describe("listQrCodes", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    const listQuery = {
      from: mocks.listFrom,
      leftJoin: mocks.listLeftJoin,
      where: mocks.listWhere,
      orderBy: mocks.listOrderBy,
      limit: mocks.listLimit,
      offset: mocks.listOffset,
    };
    mocks.listFrom.mockReturnValue(listQuery);
    mocks.listLeftJoin.mockReturnValue(listQuery);
    mocks.listWhere.mockReturnValue(listQuery);
    mocks.listOrderBy.mockReturnValue(listQuery);
    mocks.listLimit.mockReturnValue(listQuery);
    mocks.listOffset.mockResolvedValue([{ qr: { id: "qr-2" } }]);

    const countQuery = {
      from: mocks.countFrom,
      leftJoin: mocks.countLeftJoin,
      where: mocks.countWhere,
    };
    mocks.countFrom.mockReturnValue(countQuery);
    mocks.countLeftJoin.mockReturnValue(countQuery);
    mocks.countWhere.mockResolvedValue([{ total: 41 }]);
    mocks.select.mockReturnValueOnce(countQuery).mockReturnValueOnce(listQuery);
  });

  it("filters, orders, paginates, and returns a separate total", async () => {
    const result = await listQrCodes("org-1", {
      status: "active",
      mode: "dynamic",
      folderId: "folder-1",
      campaignId: "campaign-1",
      search: "catalog",
      page: 2,
      pageSize: 20,
    });

    expect(result).toEqual({ rows: [{ id: "qr-2" }], total: 41, page: 2 });
    expect(mocks.listLeftJoin).toHaveBeenCalledTimes(2);
    expect(mocks.countLeftJoin).toHaveBeenCalledTimes(2);
    expect(mocks.listWhere).toHaveBeenCalledTimes(1);
    expect(mocks.countWhere).toHaveBeenCalledTimes(1);
    expect(mocks.listOrderBy).toHaveBeenCalledTimes(1);
    expect(mocks.listLimit).toHaveBeenCalledWith(20);
    expect(mocks.listOffset).toHaveBeenCalledWith(20);
  });

  it("clamps an out-of-range page to the last page before calculating its offset", async () => {
    const result = await listQrCodes("org-1", {
      page: 99,
      pageSize: 20,
    });

    expect(result.page).toBe(3);
    expect(mocks.listOffset).toHaveBeenCalledWith(40);
  });
});
