import { describe, expect, it } from "vitest";
import { buildTrackingEvent } from "./tracking-event";

describe("buildTrackingEvent", () => {
  it("assigns a stable event id and carries server-verified consent", () => {
    const createdAt = new Date("2026-10-23T12:00:00.000Z");

    const event = buildTrackingEvent(
      {
        organizationId: "org-1",
        linkId: "link-1",
        shortLinkId: "short-1",
        sourceType: "qr_scan",
        visitorHash: "visitor-hash",
        userAgent: "Mozilla/5.0",
        consentGranted: true,
      },
      createdAt,
    );

    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.createdAt).toBe(createdAt);
    expect(event.ga4ConsentGranted).toBe(true);
    expect(event.isBot).toBe(false);
  });

  it("never grants outbox consent to known bots", () => {
    const event = buildTrackingEvent(
      {
        organizationId: "org-1",
        linkId: "link-1",
        shortLinkId: "short-1",
        sourceType: "link_click",
        visitorHash: "visitor-hash",
        userAgent: "Googlebot/2.1",
        consentGranted: true,
      },
      new Date("2026-10-23T12:00:00.000Z"),
    );

    expect(event.isBot).toBe(true);
    expect(event.ga4ConsentGranted).toBe(false);
  });
});
