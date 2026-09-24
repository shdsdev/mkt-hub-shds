import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listQrCodes: vi.fn(),
  listQrGroupAvailability: vi.fn(),
  listQrDesignTemplates: vi.fn(),
  listLinks: vi.fn(),
  listShortLinksForOrganization: vi.fn(),
  listDomains: vi.fn(),
  listFolders: vi.fn(),
  listCampaigns: vi.fn(),
  listUtmPresets: vi.fn(),
  countEventsForQrCodes: vi.fn(),
  getOrganization: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/qr", () => ({
  listQrCodes: mocks.listQrCodes,
  listQrGroupAvailability: mocks.listQrGroupAvailability,
  listQrDesignTemplates: mocks.listQrDesignTemplates,
}));
vi.mock("@/modules/links", () => ({
  listLinks: mocks.listLinks,
  listShortLinksForOrganization: mocks.listShortLinksForOrganization,
  listDomains: mocks.listDomains,
  listFolders: mocks.listFolders,
}));
vi.mock("@/modules/campaigns", () => ({ listCampaigns: mocks.listCampaigns }));
vi.mock("@/modules/utm", () => ({ listUtmPresets: mocks.listUtmPresets }));
vi.mock("@/modules/analytics", () => ({ countEventsForQrCodes: mocks.countEventsForQrCodes }));
vi.mock("@/modules/users", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("./qr-list", () => ({ QrList: () => null }));
vi.mock("./create-qr-modal", () => ({ CreateQrModal: () => null }));

import QrPage from "./page";

describe("QrPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ profile: { organizationId: "organization-1" } });
    mocks.listQrCodes.mockResolvedValue({
      rows: [{
        id: "qr-1",
        mode: "dynamic",
        shortLinkId: "short-link-1",
        linkId: "link-1",
        status: "active",
        createdAt: new Date("2026-01-01"),
        logoUrl: null,
        name: "Product QR",
        folderId: null,
        campaignId: null,
      }],
      total: 21,
      page: 2,
    });
    mocks.listQrGroupAvailability.mockResolvedValue({
      folderIds: ["folder-1"],
      campaignIds: ["campaign-1", "campaign-2"],
    });
    mocks.listLinks.mockResolvedValue([{
      id: "link-1",
      destinationUrl: "https://example.com/product",
      utmSource: "google",
      utmMedium: "paid-social",
      utmCampaign: "launch",
      utmTerm: "blue-room",
      utmContent: "hero",
    }]);
    mocks.listShortLinksForOrganization.mockResolvedValue([{ id: "short-link-1", domainId: "domain-1", slug: "product" }]);
    mocks.listDomains.mockResolvedValue([{ id: "domain-1", hostname: "go.example.com" }]);
    mocks.listFolders.mockResolvedValue([{ id: "folder-1", name: "Folder one" }]);
    mocks.listCampaigns.mockResolvedValue([
      { id: "campaign-1", name: "Active campaign", status: "active" },
      { id: "campaign-2", name: "Ended campaign", status: "ended" },
    ]);
    mocks.listUtmPresets.mockResolvedValue([]);
    mocks.listQrDesignTemplates.mockResolvedValue([]);
    mocks.getOrganization.mockResolvedValue(undefined);
    mocks.countEventsForQrCodes.mockResolvedValue(new Map([["qr-1", 7]]));
  });

  it("loads a validated paginated result and passes URL filter state to the list", async () => {
    const page = (await QrPage({
      searchParams: Promise.resolve({
        page: "2",
        status: "disabled",
        mode: "dynamic",
        folder: "folder-1",
        campaign: "campaign-1",
        q: "product",
      }),
    })) as ReactElement<{ children: ReactNode[] }>;
    const qrList = page.props.children[1] as ReactElement<{ rows: unknown[] }>;

    expect(mocks.listQrCodes).toHaveBeenCalledWith("organization-1", {
      page: 2,
      pageSize: 20,
      status: "disabled",
      mode: "dynamic",
      folderId: "folder-1",
      campaignId: "campaign-1",
      search: "product",
    });
    expect(mocks.countEventsForQrCodes).toHaveBeenCalledWith([expect.objectContaining({ id: "qr-1" })]);
    expect(mocks.listQrGroupAvailability).toHaveBeenCalledWith("organization-1");
    expect(qrList.props.rows).toEqual([expect.objectContaining({
      utmSource: "google",
      utmMedium: "paid-social",
      utmCampaign: "launch",
      utmTerm: "blue-room",
      utmContent: "hero",
      scanCount: 7,
      folderId: null,
      campaignId: null,
    })]);
    expect(qrList.props).toMatchObject({
      total: 21,
      page: 2,
      pageSize: 20,
      filter: {
        status: "disabled",
        mode: "dynamic",
        folderId: "folder-1",
        campaignId: "campaign-1",
        search: "product",
      },
      filterFolders: [{ id: "folder-1", name: "Folder one" }],
      filterCampaigns: [{ id: "campaign-1", name: "Active campaign", status: "active" }],
    });
  });
});
