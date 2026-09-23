import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { update: mocks.update },
}));

import { updateLinkUtmValues } from "./service";

describe("updateLinkUtmValues", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.returning.mockResolvedValue([]);
    mocks.where.mockReturnValue({ returning: mocks.returning });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.update.mockReturnValue({ set: mocks.set });
  });

  it("scopes persisted UTM updates to the organization", async () => {
    await expect(
      updateLinkUtmValues({
        organizationId: "org-1",
        linkId: "foreign-link",
        values: { utmSource: "google" },
      }),
    ).resolves.toBeUndefined();

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith({ utmSource: "google" });
    expect(mocks.where).toHaveBeenCalledTimes(1);
  });
});
