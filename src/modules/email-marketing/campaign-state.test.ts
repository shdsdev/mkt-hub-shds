import { describe, expect, it } from "vitest";
import { transitionEmailCampaignStatus } from "./campaign-state";

describe("email campaign state", () => {
  it("allows the draft to be scheduled and then sent", () => {
    expect(transitionEmailCampaignStatus("draft", "scheduled")).toBe("scheduled");
    expect(transitionEmailCampaignStatus("scheduled", "sending")).toBe("sending");
    expect(transitionEmailCampaignStatus("sending", "sent")).toBe("sent");
  });

  it("allows retrying a failed campaign", () => {
    expect(transitionEmailCampaignStatus("failed", "sending")).toBe("sending");
  });

  it("rejects changing a sent campaign", () => {
    expect(() => transitionEmailCampaignStatus("sent", "sending")).toThrow();
  });
});
