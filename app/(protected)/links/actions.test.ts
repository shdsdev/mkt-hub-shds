import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createLink: vi.fn(),
  createShortLink: vi.fn(),
  updateLinkDestination: vi.fn(),
  archiveLink: vi.fn(),
  archiveShortLink: vi.fn(),
  getLink: vi.fn(),
  applyUtmTemplateToLink: vi.fn(),
  recordPrintRun: vi.fn(),
  recordAudit: vi.fn(),
  checkRateLimit: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/links", () => ({
  createLink: mocks.createLink,
  createShortLink: mocks.createShortLink,
  updateLinkDestination: mocks.updateLinkDestination,
  archiveLink: mocks.archiveLink,
  archiveShortLink: mocks.archiveShortLink,
  getLink: mocks.getLink,
  applyUtmTemplateToLink: mocks.applyUtmTemplateToLink,
}));
vi.mock("@/modules/campaigns", () => ({ recordPrintRun: mocks.recordPrintRun }));
vi.mock("@/modules/audit", () => ({
  recordAudit: mocks.recordAudit,
  checkRateLimit: mocks.checkRateLimit,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createLinkAction, applyUtmTemplateAction } from "./actions";

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

const LINK_ID = "7a29aa2a-4e37-4b15-97a0-1aa6fef2f36d";
const TEMPLATE_ID = "5b83f8e0-1111-4a2b-9c3d-2aa6fef2f36d";

describe("links server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.createLink.mockResolvedValue({ id: LINK_ID });
    mocks.applyUtmTemplateToLink.mockResolvedValue({ id: LINK_ID });
  });

  it("applies the selected template server-side when a templateId is submitted", async () => {
    const formData = new FormData();
    formData.set("destinationUrl", "https://example.com/p");
    formData.set("templateId", TEMPLATE_ID);

    await createLinkAction({}, formData);

    expect(mocks.applyUtmTemplateToLink).toHaveBeenCalledWith({
      organizationId: "org-1",
      linkId: LINK_ID,
      templateId: TEMPLATE_ID,
    });
    // Applying a template never creates a Short URL or QR code.
    expect(mocks.createShortLink).not.toHaveBeenCalled();
  });

  it("does not apply a template when none is selected", async () => {
    const formData = new FormData();
    formData.set("destinationUrl", "https://example.com/p");

    await createLinkAction({}, formData);

    expect(mocks.applyUtmTemplateToLink).not.toHaveBeenCalled();
    expect(mocks.createShortLink).not.toHaveBeenCalled();
  });

  it("applyUtmTemplateAction re-fetches within the organization and creates no Short URL or QR", async () => {
    const formData = new FormData();
    formData.set("linkId", LINK_ID);
    formData.set("templateId", TEMPLATE_ID);

    await applyUtmTemplateAction({}, formData);

    expect(mocks.applyUtmTemplateToLink).toHaveBeenCalledWith({
      organizationId: "org-1",
      linkId: LINK_ID,
      templateId: TEMPLATE_ID,
    });
    expect(mocks.createShortLink).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/links/${LINK_ID}`);
  });
});
