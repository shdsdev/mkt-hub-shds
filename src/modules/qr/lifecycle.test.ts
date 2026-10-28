import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const mocks = vi.hoisted(() => ({ update: vi.fn(), set: vi.fn(), where: vi.fn(), returning: vi.fn(), select: vi.fn() }));
vi.mock("@/db/client", () => ({ db: { update: mocks.update, select: mocks.select } }));
import * as qr from "./service";

const dialect = new PgDialect();
const query = (value: SQL) => dialect.sqlToQuery(value);

beforeEach(() => {
  vi.resetAllMocks();
  const builder = { set: mocks.set, where: mocks.where, returning: mocks.returning };
  mocks.update.mockReturnValue(builder);
  mocks.set.mockReturnValue(builder);
  mocks.where.mockReturnValue(builder);
  mocks.returning.mockResolvedValue([{ id: "qr-1", status: "archived" }]);
});

describe("QR lifecycle persistence", () => {
  it("soft deletes within the organization without overwriting status", async () => {
    expect(typeof qr.deleteQrCode).toBe("function");
    await qr.deleteQrCode("qr-1", "org-1");
    expect(mocks.set).toHaveBeenCalledWith({ deletedAt: expect.any(Date) });
    const condition = query(mocks.where.mock.calls[0][0]);
    expect(condition.params).toEqual(["qr-1", "org-1"]);
    expect(condition.sql).toContain('"deleted_at" is null');
  });

  it("restores only deleted rows in the organization and preserves their status", async () => {
    expect(typeof qr.restoreQrCode).toBe("function");
    await qr.restoreQrCode("qr-1", "org-1");
    expect(mocks.set).toHaveBeenCalledWith({ deletedAt: null });
    const condition = query(mocks.where.mock.calls[0][0]);
    expect(condition.params).toEqual(["qr-1", "org-1"]);
    expect(condition.sql).toContain('"deleted_at" is not null');
  });

  it.each([
    () => qr.archiveQrCode("qr-1", "org-1"),
    () => qr.updateQrCodeName("qr-1", "Name", "org-1"),
    () => qr.updateQrDescription("qr-1", "Description", "org-1"),
    () => qr.updateQrPlacementImage("qr-1", "https://example.com/image.png", "org-1"),
  ])("scopes normal mutations and excludes deleted rows", async (mutate) => {
    await mutate();
    const condition = query(mocks.where.mock.calls[0][0]);
    expect(condition.params).toEqual(["qr-1", "org-1"]);
    expect(condition.sql).toContain('"deleted_at" is null');
  });

  it("returns undefined when no scoped row can be mutated", async () => {
    mocks.returning.mockResolvedValue([]);
    await expect(qr.archiveQrCode("foreign-qr", "org-1")).resolves.toBeUndefined();
  });

  it("looks up dynamic QR by exact short link and organization, including trash", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "qr-1", deletedAt: new Date() }]);
    const where = vi.fn().mockReturnValue({ limit });
    mocks.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
    expect(typeof qr.getQrCodeByShortLinkId).toBe("function");
    expect(await qr.getQrCodeByShortLinkId("short-1", "org-1")).toHaveProperty("id", "qr-1");
    const condition = query(where.mock.calls[0][0]);
    expect(condition.params).toEqual(["short-1", "org-1", "dynamic"]);
    expect(condition.sql).not.toContain('"deleted_at" is null');
  });
});

it("returns organization-wide navigation counts independent of list filters", async () => {
  const totalsWhere = vi.fn().mockResolvedValue([{ total: 5, trash: 2 }]);
  const folderWhere = vi.fn().mockReturnValue({ groupBy: vi.fn().mockResolvedValue([{ id: "folder-1", count: 3 }]) });
  const campaignWhere = vi.fn().mockReturnValue({ groupBy: vi.fn().mockResolvedValue([{ id: "campaign-1", count: 2 }]) });
  for (const where of [totalsWhere, folderWhere, campaignWhere]) {
    mocks.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where }) });
  }
  expect(typeof qr.getQrNavigationCounts).toBe("function");
  await expect(qr.getQrNavigationCounts("org-1")).resolves.toEqual({
    total: 5, trash: 2, folders: { "folder-1": 3 }, campaigns: { "campaign-1": 2 },
  });
  const totals = mocks.select.mock.calls[0][0];
  expect(query(totals.total).sql).toContain('count(*) filter (where "qr_codes"."deleted_at" is null)');
  expect(query(totals.trash).sql).toContain('count(*) filter (where "qr_codes"."deleted_at" is not null)');
  for (const where of [totalsWhere, folderWhere, campaignWhere]) {
    expect(query(where.mock.calls[0][0]).params).toEqual(["org-1"]);
  }
  for (const where of [folderWhere, campaignWhere]) {
    expect(query(where.mock.calls[0][0]).sql).toContain('"deleted_at" is null');
  }
});

it("returns empty navigation counts for an organization without QR codes", async () => {
  const totalsWhere = vi.fn().mockResolvedValue([{ total: 0, trash: 0 }]);
  const groupsWhere = vi.fn().mockReturnValue({ groupBy: vi.fn().mockResolvedValue([]) });
  mocks.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: totalsWhere }) })
    .mockReturnValue({ from: vi.fn().mockReturnValue({ where: groupsWhere }) });
  await expect(qr.getQrNavigationCounts("org-empty")).resolves.toEqual({ total: 0, trash: 0, folders: {}, campaigns: {} });
});
