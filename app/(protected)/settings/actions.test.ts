import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createUtmPreset: vi.fn(),
  updateUtmPreset: vi.fn(),
  archiveUtmPreset: vi.fn(),
  deleteUtmPreset: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  // Unused-by-UTM actions but imported by settings/actions.ts top-level.
  updateTheme: vi.fn(),
  isValidThemeId: vi.fn(),
  isAdmin: vi.fn(),
  updateDefaultLogo: vi.fn(),
  setThemeColorOverride: vi.fn(),
  clearThemeColorOverride: vi.fn(),
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
  deleteUtmPreset: mocks.deleteUtmPreset,
}));
vi.mock("@/modules/users", () => ({
  updateTheme: mocks.updateTheme,
  isValidThemeId: mocks.isValidThemeId,
  isAdmin: mocks.isAdmin,
  updateDefaultLogo: mocks.updateDefaultLogo,
  setThemeColorOverride: mocks.setThemeColorOverride,
  clearThemeColorOverride: mocks.clearThemeColorOverride,
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
  updateUserThemeAction,
  createUtmPresetAction,
  updateUtmPresetAction,
  archiveUtmPresetAction,
  deleteUtmPresetAction,
  setThemeColorOverrideAction,
  clearThemeColorOverrideAction,
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
    mocks.deleteUtmPreset.mockResolvedValue(undefined);
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

  it("deletes within the current organization only", async () => {
    const formData = new FormData();
    formData.set("id", TEMPLATE_ID);

    await deleteUtmPresetAction(formData);

    expect(mocks.deleteUtmPreset).toHaveBeenCalledWith(TEMPLATE_ID, "org-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/utm");
  });
});

describe("theme color override server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
  });

  function overrideFormData(overrides: Record<string, string> = {}) {
    const formData = new FormData();
    formData.set("themeId", "arctic-frost");
    formData.set("token", "primary");
    formData.set("hex", "#3772ff");
    for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
    return formData;
  }

  it("rejects an invalid hex before calling the service", async () => {
    const result = await setThemeColorOverrideAction({}, overrideFormData({ hex: "not-a-hex" }));

    expect(result.error).toBeTruthy();
    expect(mocks.setThemeColorOverride).not.toHaveBeenCalled();
  });

  it("passes the actor's role/id and revalidates on success", async () => {
    mocks.setThemeColorOverride.mockResolvedValue({ ok: true });

    const result = await setThemeColorOverrideAction({}, overrideFormData());

    expect(mocks.setThemeColorOverride).toHaveBeenCalledWith({
      actorRole: "ADMIN",
      actorUserId: "actor-1",
      themeId: "arctic-frost",
      token: "primary",
      hex: "#3772ff",
    });
    expect(result.success).toBeTruthy();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("surfaces the service's forbidden result as a permission error", async () => {
    mocks.setThemeColorOverride.mockResolvedValue({ ok: false, reason: "forbidden" });

    const result = await setThemeColorOverrideAction({}, overrideFormData());

    expect(result.error).toBeTruthy();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("clears an override and revalidates on success", async () => {
    mocks.clearThemeColorOverride.mockResolvedValue({ ok: true });
    const formData = new FormData();
    formData.set("themeId", "arctic-frost");
    formData.set("token", "accent");

    const result = await clearThemeColorOverrideAction({}, formData);

    expect(mocks.clearThemeColorOverride).toHaveBeenCalledWith({
      actorRole: "ADMIN",
      themeId: "arctic-frost",
      token: "accent",
    });
    expect(result.success).toBeTruthy();
  });

  it("surfaces the service's forbidden result on clear", async () => {
    mocks.clearThemeColorOverride.mockResolvedValue({ ok: false, reason: "forbidden" });
    const formData = new FormData();
    formData.set("themeId", "arctic-frost");
    formData.set("token", "accent");

    const result = await clearThemeColorOverrideAction({}, formData);

    expect(result.error).toBeTruthy();
  });
});

describe("user theme server action", () => {
  function userWithRole(role: string) {
    return { ...user, profile: { ...user.profile, role } };
  }

  function formDataWithTheme(themeId: string) {
    const formData = new FormData();
    formData.set("themeId", themeId);
    return formData;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isValidThemeId.mockReturnValue(true);
    mocks.checkRateLimit.mockReturnValue(true);
  });

  it.each(["MARKETING_USER", "EVENT_EDITOR", "RECEPTION"])(
    "%s can select light and dark only",
    async (role) => {
      mocks.getCurrentUser.mockResolvedValue(userWithRole(role));
      mocks.isAdmin.mockReturnValue(false);

      await updateUserThemeAction(formDataWithTheme("dark"));
      expect(mocks.updateTheme).toHaveBeenCalledWith("actor-1", "dark");

      mocks.updateTheme.mockClear();
      await updateUserThemeAction(formDataWithTheme("midnight"));
      expect(mocks.updateTheme).not.toHaveBeenCalled();
    },
  );

  it("allows admin to select a special theme", async () => {
    mocks.getCurrentUser.mockResolvedValue(userWithRole("ADMIN"));
    mocks.isAdmin.mockReturnValue(true);

    await updateUserThemeAction(formDataWithTheme("midnight"));

    expect(mocks.updateTheme).toHaveBeenCalledWith("actor-1", "midnight");
  });
});
