import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { select: mocks.select },
}));

import { countActiveQrCodes } from "./service";
import { PgDialect } from "drizzle-orm/pg-core";

describe("countActiveQrCodes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ where: mocks.where });
  });

  it("returns the active QR count from one organization-scoped query", async () => {
    mocks.where.mockResolvedValue([{ count: 12 }]);

    await expect(countActiveQrCodes("org-1")).resolves.toBe(12);
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.where).toHaveBeenCalledTimes(1);
    const condition = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(condition.params).toEqual(["org-1", "active"]);
    expect(condition.sql).toContain('"deleted_at" is null');
  });

  it("returns zero when the organization has no active QR codes", async () => {
    mocks.where.mockResolvedValue([]);

    await expect(countActiveQrCodes("org-1")).resolves.toBe(0);
  });
});
