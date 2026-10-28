import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listQrCodes: vi.fn(),
  getQrNavigationCounts: vi.fn(),
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
  listQrGroupAvailability: async () => ({ folderIds: [], campaignIds: [] }),
  listQrCodes: mocks.listQrCodes,
  getQrNavigationCounts: mocks.getQrNavigationCounts,
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
        deletedAt: null,
        logoUrl: null,
        name: "Product QR",
        folderId: null,
        campaignId: null,
      }],
      total: 21,
      page: 2,
    });
    mocks.getQrNavigationCounts.mockResolvedValue({ total: 21, trash: 2, folders: { "folder-1": 1 }, campaigns: { "campaign-2": 1 } });
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
      campaignId: undefined,
      search: "product",
      trash: false,
    });
    expect(mocks.countEventsForQrCodes).toHaveBeenCalledWith([expect.objectContaining({ id: "qr-1" })]);
    expect(mocks.getQrNavigationCounts).toHaveBeenCalledWith("organization-1");
    expect(qrList.props.rows).toEqual([expect.objectContaining({
      utmSource: "google",
      utmMedium: "paid-social",
      utmCampaign: "launch",
      utmTerm: "blue-room",
      utmContent: "hero",
      scanCount: 7,
      folderId: null,
      campaignId: null,
      deletedAt: null,
    })]);
    expect(qrList.props).toMatchObject({
      total: 21,
      page: 2,
      pageSize: 20,
      filter: {
        status: "disabled",
        mode: "dynamic",
        folderId: "folder-1",
        campaignId: undefined,
        search: "product",
      },
      navigationCounts: { total: 21, trash: 2 },
      navigationCampaigns: [
        { id: "campaign-1", name: "Active campaign", status: "active" },
        { id: "campaign-2", name: "Ended campaign", status: "ended" },
      ],
    });
  });

  it("gives trash precedence over folder and campaign and maps deleted rows", async () => {
    const deletedAt = new Date("2026-10-01");
    mocks.listQrCodes.mockResolvedValue({ rows: [{ id: "static-1", mode: "static", deletedAt }], total: 1, page: 1 });
    const page = await QrPage({ searchParams: Promise.resolve({ trash: "1", folder: "folder-1", campaign: "campaign-2" }) }) as ReactElement<{ children: ReactNode[] }>;
    expect(mocks.listQrCodes).toHaveBeenCalledWith("organization-1", expect.objectContaining({ trash: true, folderId: undefined, campaignId: undefined }));
    const list = page.props.children[1] as ReactElement<{ rows: unknown[] }>;
    expect(list.props.rows).toEqual([expect.objectContaining({ deletedAt })]);
  });

  it("does not treat trash=0 as true and retains empty folders", async () => {
    mocks.listFolders.mockResolvedValue([{ id: "empty", name: "Empty folder" }]);
    const page = await QrPage({ searchParams: Promise.resolve({ trash: "0" }) }) as ReactElement<{ children: ReactNode[] }>;
    expect(mocks.listQrCodes).toHaveBeenCalledWith("organization-1", expect.objectContaining({ trash: false }));
    const list = page.props.children[1] as ReactElement;
    expect(list.props).toMatchObject({ folders: [{ id: "empty", name: "Empty folder" }] });
  });

  it("includes empty ended campaigns in navigation", async () => {
    const campaigns = [{ id: "empty-ended", name: "Past launch", status: "ended" }];
    mocks.listCampaigns.mockResolvedValue(campaigns);
    const page = await QrPage({ searchParams: Promise.resolve({}) }) as ReactElement<{ children: ReactNode[] }>;
    const list = page.props.children[1] as ReactElement;
    expect(list.props).toMatchObject({ navigationCampaigns: campaigns });
  });
});
