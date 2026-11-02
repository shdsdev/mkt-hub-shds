import { describe, expect, it } from "vitest";
import { resolveCampaignCompletionStatus } from "./campaign-processing";

describe("campaign processing", () => {
  it("marks a campaign failed when any recipient fails", () => {
    expect(resolveCampaignCompletionStatus(["sent", "failed"])).toBe("failed");
  });

  it("marks a campaign sent when every recipient was accepted", () => {
    expect(resolveCampaignCompletionStatus(["sent", "sent"])).toBe("sent");
  });

  it("does not mark an empty campaign as sent", () => {
    expect(resolveCampaignCompletionStatus([])).toBe("failed");
  });
});
