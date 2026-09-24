import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveUtmTemplate: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: { update: mocks.update, select: mocks.select } }));
vi.mock("@/modules/utm", () => ({ getActiveUtmTemplate: mocks.getActiveUtmTemplate }));

import {
  applyTemplateToDestination,
  mergeCustomParametersToDestination,
  applyUtmTemplateToLink,
} from "./service";

const template = {
  id: "t1",
  name: "Google CPC",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "spring",
  utmTerm: null,
  utmContent: null,
  utmId: "camp_123",
  customParameters: [{ key: "promo", value: "early" }],
};

const existingLink = {
  id: "link-1",
  organizationId: "org-1",
  destinationUrl: "https://example.com/p?utm_source=old&a=1",
  utmSource: "old",
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  utmId: null,
  folderId: null,
  status: "active",
  createdAt: new Date("2026-09-23T00:00:00.000Z"),
};

describe("applyTemplateToDestination", () => {
  it("replaces matching keys and sets non-empty values", () => {
    const url = new URL(applyTemplateToDestination("https://e.com?utm_source=old&a=1", template));
    expect(url.searchParams.get("utm_source")).toBe("google");
    expect(url.searchParams.get("utm_medium")).toBe("cpc");
    expect(url.searchParams.get("utm_campaign")).toBe("spring");
    expect(url.searchParams.get("utm_id")).toBe("camp_123");
  });

  it("omits empty template values", () => {
    const url = new URL(
      applyTemplateToDestination("https://e.com", { ...template, utmTerm: null, utmContent: null }),
    );
    expect(url.searchParams.has("utm_term")).toBe(false);
    expect(url.searchParams.has("utm_content")).toBe(false);
  });

  it("preserves unrelated query parameters and the hash", () => {
    const url = new URL(applyTemplateToDestination("https://e.com?x=1#section", template));
    expect(url.searchParams.get("x")).toBe("1");
    expect(url.hash).toBe("#section");
  });

  it("never lets a custom pair override a standard utm_ key", () => {
    const result = applyTemplateToDestination("https://e.com", {
      ...template,
      customParameters: [{ key: "utm_source", value: "evil" }],
    });
    expect(new URL(result).searchParams.get("utm_source")).toBe("google");
  });
});

describe("mergeCustomParametersToDestination", () => {
  it("strips standard keys and merges only custom pairs", () => {
    const url = new URL(
      mergeCustomParametersToDestination("https://e.com?utm_source=old&a=1", template.customParameters),
    );
    expect(url.searchParams.has("utm_source")).toBe(false);
    expect(url.searchParams.get("a")).toBe("1");
    expect(url.searchParams.get("promo")).toBe("early");
  });
});

describe("applyUtmTemplateToLink", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.where.mockReturnValue({ limit: mocks.limit, returning: mocks.returning });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.limit.mockResolvedValue([existingLink]);
    mocks.returning.mockResolvedValue([{ ...existingLink, utmSource: "google" }]);
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.getActiveUtmTemplate.mockResolvedValue(template);
  });

  it("rejects a template that is draft, archived, or from another organization", async () => {
    mocks.getActiveUtmTemplate.mockResolvedValue(undefined);

    await expect(
      applyUtmTemplateToLink({ organizationId: "org-1", linkId: "link-1", templateId: "t1" }),
    ).rejects.toThrow(/no está disponible/);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("persists standard values in columns and custom pairs in the destination", async () => {
    await applyUtmTemplateToLink({ organizationId: "org-1", linkId: "link-1", templateId: "t1" });

    expect(mocks.set).toHaveBeenCalledWith({
      destinationUrl: "https://example.com/p?a=1&promo=early",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "spring",
      utmTerm: null,
      utmContent: null,
      utmId: "camp_123",
    });
  });

  it("updates only the link — no short link or QR mutation", async () => {
    await applyUtmTemplateToLink({ organizationId: "org-1", linkId: "link-1", templateId: "t1" });
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
});
