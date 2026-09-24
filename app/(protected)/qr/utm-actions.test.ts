import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  checkRateLimit: vi.fn(),
  getQrCode: vi.fn(),
  updateQrCodeName: vi.fn(),
  getLink: vi.fn(),
  updateLinkUtmValues: vi.fn(),
  createShortLink: vi.fn(),
  normalizeUtmValue: vi.fn(),
  recordAudit: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/audit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  recordAudit: mocks.recordAudit,
}));
vi.mock("@/modules/qr", () => ({
  getQrCode: mocks.getQrCode,
  updateQrCodeName: mocks.updateQrCodeName,
  createDynamicQrCode: vi.fn(),
  createStaticQrCode: vi.fn(),
  createQrDesignTemplate: vi.fn(),
  archiveQrCode: vi.fn(),
  buildStaticPayload: vi.fn(),
}));
vi.mock("@/modules/links", () => ({
  createLink: vi.fn(),
  createShortLink: mocks.createShortLink,
  createFolder: vi.fn(),
  listDomains: vi.fn(),
  listFolders: vi.fn(),
  getLink: mocks.getLink,
  updateLinkUtmValues: mocks.updateLinkUtmValues,
}));
vi.mock("@/modules/campaigns", () => ({ createCampaign: vi.fn(), listCampaigns: vi.fn() }));
vi.mock("@/modules/utm", () => ({
  normalizeUtmValue: mocks.normalizeUtmValue,
  createUtmPreset: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { updateDynamicQrUtmAction } from "./actions";

const user = { id: "user-1", profile: { organizationId: "org-1" } };
const qr = {
  id: "00000000-0000-4000-8000-000000000001",
  mode: "dynamic",
  linkId: "link-1",
  organizationId: "org-1",
};
const link = {
  id: "link-1",
  organizationId: "org-1",
  destinationUrl: "https://example.com/product",
  utmSource: "old-source",
  utmMedium: "old-medium",
  utmCampaign: "old-campaign",
  utmTerm: "old-term",
  utmContent: "old-content",
};

function utmFormData(values: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("qrId", qr.id);
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe("updateDynamicQrUtmAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.getQrCode.mockResolvedValue(qr);
    mocks.getLink.mockResolvedValue(link);
    mocks.updateLinkUtmValues.mockResolvedValue({ ...link, utmSource: "google" });
    mocks.normalizeUtmValue.mockImplementation((value: string) => value.trim().toLowerCase().replace(/\s+/g, "-"));
  });

  it("rejects unavailable QR codes before reading or mutating links", async () => {
    mocks.getQrCode.mockResolvedValue({ ...qr, organizationId: "org-2" });

    await expect(updateDynamicQrUtmAction({}, utmFormData({ utmSource: "Google" }))).resolves.toEqual({
      error: "El código QR no está disponible.",
    });

    expect(mocks.getLink).not.toHaveBeenCalled();
    expect(mocks.updateLinkUtmValues).not.toHaveBeenCalled();
  });

  it("rejects foreign links and destinations with reserved UTM parameters", async () => {
    mocks.getLink.mockResolvedValueOnce({ ...link, organizationId: "org-2" });

    await expect(updateDynamicQrUtmAction({}, utmFormData())).resolves.toEqual({
      error: "La URL de destino no permite etiquetas UTM editables.",
    });

    mocks.getLink.mockResolvedValueOnce({ ...link, destinationUrl: "https://example.com/?utm_source=locked" });
    await expect(updateDynamicQrUtmAction({}, utmFormData())).resolves.toEqual({
      error: "La URL de destino no permite etiquetas UTM editables.",
    });

    expect(mocks.updateLinkUtmValues).not.toHaveBeenCalled();
  });

  it("normalizes all UTM values and audits only the persisted before and after values", async () => {
    const after = {
      ...link,
      utmSource: "google",
      utmMedium: "paid_social",
      utmCampaign: "launch_2026",
      utmTerm: "blue_widget",
      utmContent: "hero_banner",
    };
    mocks.updateLinkUtmValues.mockResolvedValue(after);

    await expect(
      updateDynamicQrUtmAction({}, utmFormData({
        utmSource: " Google ",
        utmMedium: " Paid Social ",
        utmCampaign: " Launch 2026 ",
        utmTerm: " Blue Widget ",
        utmContent: " Hero Banner ",
      })),
    ).resolves.toEqual({ success: "Etiquetas UTM actualizadas." });

    expect(mocks.updateLinkUtmValues).toHaveBeenCalledWith({
      organizationId: "org-1",
      linkId: "link-1",
      values: {
        utmSource: "google",
        utmMedium: "paid_social",
        utmCampaign: "launch_2026",
        utmTerm: "blue_widget",
        utmContent: "hero_banner",
      },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      action: "destination_change",
      resourceType: "link",
      resourceId: "link-1",
      before: {
        utmSource: "old-source",
        utmMedium: "old-medium",
        utmCampaign: "old-campaign",
        utmTerm: "old-term",
        utmContent: "old-content",
      },
      after: {
        utmSource: "google",
        utmMedium: "paid_social",
        utmCampaign: "launch_2026",
        utmTerm: "blue_widget",
        utmContent: "hero_banner",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/qr");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/links/link-1");
    expect(mocks.updateQrCodeName).not.toHaveBeenCalled();
    expect(mocks.createShortLink).not.toHaveBeenCalled();
  });

  it("does not audit or revalidate when the scoped update finds no link", async () => {
    mocks.updateLinkUtmValues.mockResolvedValue(undefined);

    await expect(updateDynamicQrUtmAction({}, utmFormData({ utmSource: "Google" }))).resolves.toEqual({
      error: "La URL de destino no permite etiquetas UTM editables.",
    });

    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
