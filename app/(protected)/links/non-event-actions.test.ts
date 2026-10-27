import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const functions = (names: string[]) => Object.fromEntries(names.map((name) => [name, vi.fn()]));
  return {
    getCurrentUser: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn(),
    audit: functions(["recordAudit", "checkRateLimit"]),
    links: functions(["createLink", "createShortLink", "updateLinkDestination", "archiveLink", "archiveShortLink",
      "getLink", "applyUtmTemplateToLink", "createFolder", "listDomains", "listFolders", "updateLinkUtmValues",
      "createDomain", "updateDomain", "deleteDomain", "getDomain", "reassignShortLinksToDomain"]),
    qr: functions(["createDynamicQrCode", "createStaticQrCode", "createQrDesignTemplate", "archiveQrCode",
      "getQrCode", "updateQrCodeName", "updateQrDescription", "updateQrPlacementImage", "buildStaticPayload"]),
    campaigns: functions(["createCampaign", "endCampaign", "recordPrintRun", "listCampaigns"]),
     users: functions(["updateTheme", "isValidThemeId", "updateDefaultLogo", "setThemeColorOverride", "clearThemeColorOverride", "isActive", "isAdmin"]),
    utm: functions(["createUtmPreset", "updateUtmPreset", "archiveUtmPreset", "deleteUtmPreset"]),
    notifications: functions(["markUserNotificationRead"]),
  };
});

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/modules/audit", () => mocks.audit);
vi.mock("@/modules/links", () => mocks.links);
vi.mock("@/modules/qr", () => mocks.qr);
vi.mock("@/modules/campaigns", () => mocks.campaigns);
vi.mock("@/modules/users", () => mocks.users);
vi.mock("@/modules/utm", () => mocks.utm);
vi.mock("@/modules/notifications", () => mocks.notifications);

import * as links from "./actions";
import * as qr from "../qr/actions";
import * as campaigns from "../campaigns/actions";
import * as settings from "../settings/actions";
import { markNotificationReadAction } from "../notifications/actions";

const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const design = {
  backgroundColor: "#ffffff", foregroundColor: "#000000", errorCorrectionLevel: "M" as const,
  dotsType: "square" as const, cornersSquareType: "square" as const, cornersDotType: "square" as const,
};
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    id, linkId: id, shortLinkId: id, domainId: id, templateId: id, qrId: id, campaignId: id,
    fromId: id, toId: otherId, notificationId: id, name: "Campaign", destinationUrl: "https://example.com",
    hostname: "go.example.com", slug: "campaign", quantity: "10", themeId: "arctic-frost",
    logoUrl: "https://example.com/logo.png", placementImageUrl: "https://example.com/photo.png",
    description: "Description", utmSource: "newsletter", utmMedium: "email", utmCampaign: "launch",
    sourceMode: "external", kind: "text", content: "Hello", saveAsTemplate: "true", templateName: "Design",
    saveUtmAsPreset: "true", utmPresetName: "Launch", ...design,
  })) data.set(key, value);
  return data;
}

const cases = [
  ["createLink", () => links.createLinkAction({}, form()), mocks.links.createLink],
  ["applyUtmTemplate", () => links.applyUtmTemplateAction({}, form()), mocks.links.applyUtmTemplateToLink],
  ["createShortLink", () => links.createShortLinkAction({}, form()), mocks.links.createShortLink],
  ["updateDestination", () => links.updateDestinationAction({}, form()), mocks.links.updateLinkDestination],
  ["archiveLink", () => links.archiveLinkAction(form()), mocks.links.archiveLink],
  ["archiveShortLink", () => links.archiveShortLinkAction(form()), mocks.links.archiveShortLink],
  ["recordPrintRun", () => links.recordPrintRunAction({}, form()), mocks.campaigns.recordPrintRun],
  ["createWebsiteQrCode", () => qr.createWebsiteQrCodeAction({}, form()), mocks.qr.createDynamicQrCode],
  ["createStaticQrCode", () => qr.createStaticQrCodeAction({}, form()), mocks.qr.createStaticQrCode],
  ["createFolderQuick", () => qr.createFolderQuickAction("Folder"), mocks.links.createFolder],
  ["createCampaignQuick", () => qr.createCampaignQuickAction("Campaign"), mocks.campaigns.createCampaign],
  ["archiveQrCode", () => qr.archiveQrCodeAction(form()), mocks.qr.archiveQrCode],
  ["updateQrName", () => qr.updateQrNameAction({}, form()), mocks.qr.updateQrCodeName],
  ["updateQrMetadata", () => qr.updateQrMetadataAction({}, form()), mocks.qr.updateQrDescription],
  ["updateDynamicQrUtm", () => qr.updateDynamicQrUtmAction({}, form()), mocks.links.updateLinkUtmValues],
  ["createBulkWebsiteQrCodes", () => qr.createBulkWebsiteQrCodesAction({
    rows: [{ rowNumber: 1, title: "QR", url: "https://example.com" }], folderId: id,
    design, saveAsTemplate: true, templateName: "Bulk design",
  }), mocks.qr.createDynamicQrCode],
  ["createCampaign", () => campaigns.createCampaignAction({}, form()), mocks.campaigns.createCampaign],
  ["endCampaign", () => campaigns.endCampaignAction(form()), mocks.campaigns.endCampaign],
  ["markNotificationRead", () => markNotificationReadAction(form()), mocks.notifications.markUserNotificationRead],
  ["updateUserTheme", () => settings.updateUserThemeAction(form()), mocks.users.updateTheme],
  ["updateDefaultLogo", () => settings.updateDefaultLogoAction(form()), mocks.users.updateDefaultLogo],
  ["createDomain", () => settings.createDomainAction({}, form()), mocks.links.createDomain],
  ["updateDomain", () => settings.updateDomainAction({}, form()), mocks.links.updateDomain],
  ["reassignDomainShortLinks", () => settings.reassignDomainShortLinksAction({}, form()), mocks.links.reassignShortLinksToDomain],
  ["deleteDomain", () => settings.deleteDomainAction({}, form()), mocks.links.deleteDomain],
  ["createUtmPreset", () => settings.createUtmPresetAction({}, form()), mocks.utm.createUtmPreset],
  ["updateUtmPreset", () => settings.updateUtmPresetAction({}, form()), mocks.utm.updateUtmPreset],
  ["archiveUtmPreset", () => settings.archiveUtmPresetAction(form()), mocks.utm.archiveUtmPreset],
  ["deleteUtmPreset", () => settings.deleteUtmPresetAction(form()), mocks.utm.deleteUtmPreset],
] as const;

const services = [mocks.audit, mocks.links, mocks.qr, mocks.campaigns, mocks.users, mocks.utm, mocks.notifications];
beforeEach(() => {
  vi.resetAllMocks();
  const record = { id, organizationId: "org-1", linkId: id, mode: "dynamic", destinationUrl: "https://example.com" };
  for (const service of services) {
    for (const fn of Object.values(service)) fn.mockResolvedValue(record);
  }
  mocks.audit.checkRateLimit.mockReturnValue(true);
  mocks.users.isActive.mockReturnValue(true);
  mocks.users.isValidThemeId.mockReturnValue(true);
  mocks.users.isAdmin.mockImplementation((profile: { role: string }) => profile.role === "ADMIN");
  mocks.qr.buildStaticPayload.mockReturnValue("Hello");
  for (const name of ["listDomains", "listFolders"]) mocks.links[name].mockResolvedValue([record]);
  mocks.campaigns.listCampaigns.mockResolvedValue([record]);
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
  mocks.getCurrentUser.mockResolvedValue({ id: "user-1", profile: { role: "RECEPTION", status: "active", organizationId: "org-1" } });
});

describe("non-event action authorization independent of the request URL", () => {
  it.each(cases)("rejects RECEPTION in %s before any side effects with valid input", async (_name, invoke) => {
    const result = await invoke().then(() => undefined, (error: unknown) => error);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    for (const service of services) {
      for (const [name, fn] of Object.entries(service)) {
        if (name !== "isActive" && name !== "isAdmin") expect(fn, name).not.toHaveBeenCalled();
      }
    }
    if (_name !== "markNotificationRead") expect(result).toEqual(new Error("REDIRECT:/login"));
  });

  it.each(cases)("retains authorized marketing behavior in %s with the same valid input", async (_name, invoke, mutation) => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", profile: { role: "MARKETING_USER", status: "active", organizationId: "org-1" } });
    const result = await invoke().then(() => undefined, (error: unknown) => error);
    if (_name === "updateUserTheme") expect(result).toEqual(new Error("REDIRECT:/login"));
    else if (_name === "createLink") expect(result).toEqual(new Error(`REDIRECT:/links/${id}`));
    else expect(result).toBeUndefined();
    if (_name === "updateUserTheme") {
      expect(mutation).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    } else {
      expect(mutation).toHaveBeenCalled();
      expect(mocks.revalidatePath).toHaveBeenCalled();
    }
  });
});
