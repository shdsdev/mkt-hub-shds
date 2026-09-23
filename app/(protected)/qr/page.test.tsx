import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listQrCodes: vi.fn(),
  listQrDesignTemplates: vi.fn(),
  listLinks: vi.fn(),
  listShortLinksForOrganization: vi.fn(),
  listDomains: vi.fn(),
  listFolders: vi.fn(),
  listCampaigns: vi.fn(),
  listUtmPresets: vi.fn(),
  countEventsForQrCode: vi.fn(),
  getOrganization: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/qr", () => ({
  listQrCodes: mocks.listQrCodes,
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
vi.mock("@/modules/analytics", () => ({ countEventsForQrCode: mocks.countEventsForQrCode }));
vi.mock("@/modules/users", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("./qr-list", () => ({ QrList: () => null }));

import QrPage from "./page";

describe("QrPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ profile: { organizationId: "organization-1" } });
    mocks.listQrCodes.mockResolvedValue([{
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
    }]);
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
    mocks.listFolders.mockResolvedValue([]);
    mocks.listCampaigns.mockResolvedValue([]);
    mocks.listUtmPresets.mockResolvedValue([]);
    mocks.listQrDesignTemplates.mockResolvedValue([]);
    mocks.getOrganization.mockResolvedValue(undefined);
    mocks.countEventsForQrCode.mockResolvedValue(0);
  });

  it("passes all persisted UTM values to dynamic QR rows", async () => {
    const page = (await QrPage()) as ReactElement<{ children: ReactNode[] }>;
    const qrList = page.props.children[1] as ReactElement<{ rows: unknown[] }>;

    expect(qrList.props.rows).toEqual([expect.objectContaining({
      utmSource: "google",
      utmMedium: "paid-social",
      utmCampaign: "launch",
      utmTerm: "blue-room",
      utmContent: "hero",
    })]);
  });
});
