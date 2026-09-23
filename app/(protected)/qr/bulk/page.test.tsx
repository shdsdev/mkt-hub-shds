import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listFolders: vi.fn(),
  listCampaigns: vi.fn(),
  listQrDesignTemplates: vi.fn(),
  getOrganization: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/links", () => ({ listFolders: mocks.listFolders }));
vi.mock("@/modules/campaigns", () => ({ listCampaigns: mocks.listCampaigns }));
vi.mock("@/modules/qr", () => ({ listQrDesignTemplates: mocks.listQrDesignTemplates }));
vi.mock("@/modules/users", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("./bulk-qr-import", () => ({ BulkQrImport: () => null }));

import BulkQrImportPage from "./page";

describe("BulkQrImportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ profile: { organizationId: "organization-1" } });
    mocks.listFolders.mockResolvedValue([{ id: "folder-1", name: "Folder" }]);
    mocks.listCampaigns.mockResolvedValue([{ id: "campaign-1", name: "Campaign" }]);
    mocks.listQrDesignTemplates.mockResolvedValue([{ id: "template-1", name: "Template" }]);
    mocks.getOrganization.mockResolvedValue({ defaultLogoUrl: "https://example.com/logo.svg" });
  });

  it("loads organization-scoped configuration and passes it to the bulk wizard", async () => {
    const page = (await BulkQrImportPage()) as ReactElement<{ children: ReactNode[] }>;
    const wizard = page.props.children[1] as ReactElement;

    expect(mocks.listFolders).toHaveBeenCalledWith("organization-1");
    expect(mocks.listCampaigns).toHaveBeenCalledWith("organization-1");
    expect(mocks.listQrDesignTemplates).toHaveBeenCalledWith("organization-1");
    expect(mocks.getOrganization).toHaveBeenCalledWith("organization-1");
    expect(wizard.props).toMatchObject({
      organizationId: "organization-1",
      folders: [{ id: "folder-1", name: "Folder" }],
      campaigns: [{ id: "campaign-1", name: "Campaign" }],
      templates: [{ id: "template-1", name: "Template" }],
      defaultLogoUrl: "https://example.com/logo.svg",
    });
  });
});
