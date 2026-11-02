import { describe, expect, it } from "vitest";
import { parseCampaignSchedule } from "./campaign-config";

describe("campaign scheduling", () => {
  it("keeps drafts unscheduled", () => {
    expect(parseCampaignSchedule({ sendMode: "draft" })).toEqual({ status: "draft", scheduledAt: null });
  });

  it("prepares immediate sends for the worker", () => {
    const now = new Date("2026-10-23T12:00:00.000Z");
    expect(parseCampaignSchedule({ sendMode: "now" }, now)).toEqual({ status: "scheduled", scheduledAt: now });
  });

  it("rejects scheduled campaigns without a future date", () => {
    expect(() => parseCampaignSchedule({ sendMode: "scheduled", scheduledAt: "2026-10-23T11:00:00.000Z" }, new Date("2026-10-23T12:00:00.000Z"))).toThrow("future");
  });
});
