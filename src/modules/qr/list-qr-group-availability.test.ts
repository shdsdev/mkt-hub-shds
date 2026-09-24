import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectDistinct: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { selectDistinct: mocks.selectDistinct },
}));

import { listQrGroupAvailability } from "./service";

describe("listQrGroupAvailability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns distinct non-null folder and campaign ids with QR codes", async () => {
    const folderWhere = vi.fn().mockResolvedValue([{ id: "folder-1" }, { id: "folder-2" }]);
    const campaignWhere = vi.fn().mockResolvedValue([{ id: "campaign-1" }, { id: "campaign-2" }]);
    const folderFrom = vi.fn().mockReturnValue({ where: folderWhere });
    const campaignFrom = vi.fn().mockReturnValue({ where: campaignWhere });
    mocks.selectDistinct
      .mockReturnValueOnce({ from: folderFrom })
      .mockReturnValueOnce({ from: campaignFrom });

    await expect(listQrGroupAvailability("org-1")).resolves.toEqual({
      folderIds: ["folder-1", "folder-2"],
      campaignIds: ["campaign-1", "campaign-2"],
    });
    expect(mocks.selectDistinct).toHaveBeenCalledTimes(2);
  });
});
