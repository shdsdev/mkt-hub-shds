import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listUtmPresets: vi.fn(),
  listCampaigns: vi.fn(),
  getActiveTaxonomyOptions: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/utm", () => ({
  listUtmPresets: mocks.listUtmPresets,
  getActiveTaxonomyOptions: mocks.getActiveTaxonomyOptions,
  SOURCE_OPTIONS: [],
  MEDIUM_OPTIONS: [],
}));
vi.mock("@/modules/campaigns", () => ({ listCampaigns: mocks.listCampaigns }));
vi.mock("./utm-presets-form", () => ({
  UtmPresetsForm: ({ campaigns, presets }: { campaigns: unknown[]; presets: unknown[] }) => (
    <div data-campaigns={campaigns.length} data-presets={presets.length} />
  ),
}));

import UtmSettingsPage from "./page";

const user = {
  id: "u1",
  email: "a@b.c",
  profile: {
    id: "u1",
    organizationId: "org-1",
    role: "ADMIN",
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
};

describe("UtmSettingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.listUtmPresets.mockResolvedValue([]);
    mocks.listCampaigns.mockResolvedValue([]);
    mocks.getActiveTaxonomyOptions.mockReturnValue([]);
  });

  it("loads campaigns (prefill source) and presets for the current organization", async () => {
    await UtmSettingsPage();
    expect(mocks.listCampaigns).toHaveBeenCalledWith("org-1");
    expect(mocks.listUtmPresets).toHaveBeenCalledWith("org-1");
  });

  it("derives selectable choices from active taxonomy options only", async () => {
    await UtmSettingsPage();
    expect(mocks.getActiveTaxonomyOptions).toHaveBeenCalled();
  });
});
