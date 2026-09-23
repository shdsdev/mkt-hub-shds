import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { buildDestinationUrl, type Link } from "./service";

const link: Link = {
  id: "link-1",
  organizationId: "org-1",
  destinationUrl: "https://example.com/p",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  folderId: null,
  status: "active",
  createdAt: new Date("2026-09-23T00:00:00.000Z"),
};

describe("buildDestinationUrl", () => {
  it("replaces only persisted UTM keys when building a redirect", () => {
    expect(
      buildDestinationUrl({
        ...link,
        destinationUrl: "https://example.com/p?a=1",
        utmSource: "google",
        utmContent: "hero",
      }),
    ).toBe("https://example.com/p?a=1&utm_source=google&utm_content=hero");
  });
});
