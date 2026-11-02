import { describe, expect, it } from "vitest";
import { getCampaignResultRedirect } from "./campaign-result";

describe("getCampaignResultRedirect", () => {
  it("redirects delivered campaigns away from the draft editor", () => {
    expect(getCampaignResultRedirect("campaign-123", "scheduled")).toBe(
      "/email-marketing/campaigns/campaign-123",
    );
    expect(getCampaignResultRedirect("campaign-123", "now")).toBe(
      "/email-marketing/campaigns/campaign-123",
    );
  });

  it("keeps draft saves in the editor", () => {
    expect(getCampaignResultRedirect("campaign-123", "draft")).toBeUndefined();
  });
});
