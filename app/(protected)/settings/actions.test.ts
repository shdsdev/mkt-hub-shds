import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createUtmPreset: vi.fn(),
  updateUtmPreset: vi.fn(),
  archiveUtmPreset: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  // Unused-by-UTM actions but imported by settings/actions.ts top-level.
  updateTheme: vi.fn(),
  isValidThemeId: vi.fn(),
  updateDefaultLogo: vi.fn(),
  createDomain: vi.fn(),
  updateDomain: vi.fn(),
  deleteDomain: vi.fn(),
  getDomain: vi.fn(),
  reassignShortLinksToDomain: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/utm", () => ({
  createUtmPreset: mocks.createUtmPreset,
  updateUtmPreset: mocks.updateUtmPreset,
  archiveUtmPreset: mocks.archiveUtmPreset,
}));
vi.mock("@/modules/users", () => ({
  updateTheme: mocks.updateTheme,
  isValidThemeId: mocks.isValidThemeId,
  updateDefaultLogo: mocks.updateDefaultLogo,
}));
vi.mock("@/modules/links", () => ({
  createDomain: mocks.createDomain,
  updateDomain: mocks.updateDomain,
  deleteDomain: mocks.deleteDomain,
  getDomain: mocks.getDomain,
  reassignShortLinksToDomain: mocks.reassignShortLinksToDomain,
}));
vi.mock("@/modules/audit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createUtmPresetAction,
  updateUtmPresetAction,
  archiveUtmPresetAction,
} from "./actions";

const user = {
  id: "actor-1",
  email: "admin@example.com",
  profile: {
    id: "actor-1",
    organizationId: "org-1",
    role: "ADMIN",
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
};

const TEMPLATE_ID = "7a29aa2a-4e37-4b15-97a0-1aa6fef2f36d";

function baseFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("name", "Google CPC");
  formData.set("utmSource", "google");
  formData.set("utmMedium", "cpc");
  formData.set("utmCampaign", "spring");
  formData.set("status", "active");
  formData.set("sourceMode", "controlled");
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

describe("utm settings server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.createUtmPreset.mockResolvedValue({ id: TEMPLATE_ID });
    mocks.updateUtmPreset.mockResolvedValue({ id: TEMPLATE_ID });
    mocks.archiveUtmPreset.mockResolvedValue({ id: TEMPLATE_ID });
  });

  it("passes organization id, creator, and typed custom parameters to the service", async () => {
    const formData = baseFormData();
    formData.set("customParameters", JSON.stringify([{ key: "promo", value: "x" }]));

    await createUtmPresetAction({}, formData);

    expect(mocks.createUtmPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        createdBy: "actor-1",
        utmSource: "google",
        sourceMode: "controlled",
        status: "active",
        customParameters: [{ key: "promo", value: "x" }],
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/utm");
  });

  it("forwards partner mode for a custom source", async () => {
    await createUtmPresetAction(
      {},
      baseFormData({ utmSource: "my partner agency", sourceMode: "partner" }),
    );
    expect(mocks.createUtmPreset).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMode: "partner", utmSource: "my partner agency" }),
    );
  });

  it("rejects malformed custom parameters before calling the service", async () => {
    const formData = baseFormData();
    formData.set("customParameters", "not-json");

    const result = await createUtmPresetAction({}, formData);
    expect(result.error).toBeDefined();
    expect(mocks.createUtmPreset).not.toHaveBeenCalled();
  });

  it("surfaces service validation errors (reserved keys) to the caller", async () => {
    mocks.createUtmPreset.mockRejectedValue(new Error('La clave "utm_source" está reservada.'));

    const result = await createUtmPresetAction({}, baseFormData());
    expect(result.error).toMatch(/reservada/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("updates within the current organization only", async () => {
    const formData = baseFormData();
    formData.set("id", TEMPLATE_ID);

    await updateUtmPresetAction({}, formData);

    expect(mocks.updateUtmPreset).toHaveBeenCalledWith(
      expect.objectContaining({ id: TEMPLATE_ID, organizationId: "org-1" }),
    );
  });

  it("archives within the current organization only", async () => {
    const formData = new FormData();
    formData.set("id", TEMPLATE_ID);

    await archiveUtmPresetAction(formData);

    expect(mocks.archiveUtmPreset).toHaveBeenCalledWith(TEMPLATE_ID, "org-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/utm");
  });
});
