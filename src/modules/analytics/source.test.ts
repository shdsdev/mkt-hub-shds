import { describe, expect, it } from "vitest";
import { getAnalyticsSource } from "./source";

describe("getAnalyticsSource", () => {
  it("keeps QR scans and link clicks in non-overlapping source contracts", () => {
    expect(getAnalyticsSource("qr")).toMatchObject({
      eventType: "qr_scan",
      metric: "scans",
      csvColumn: "scans_human",
    });
    expect(getAnalyticsSource("links")).toMatchObject({
      eventType: "link_click",
      metric: "clicks",
      csvColumn: "clicks_human",
    });
  });
});
