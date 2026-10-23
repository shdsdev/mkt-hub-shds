import { describe, expect, it, vi } from "vitest";
import { buildMeasurementProtocolRequest, sendMeasurementProtocolEvent } from "./google";

const event = {
  id: "event-1",
  clientId: "client-1",
  linkId: "link-1",
  shortLinkId: "short-1",
  sourceType: "qr_scan" as const,
};

describe("Google Analytics Measurement Protocol", () => {
  it("builds an anonymous event payload without credentials or personal data", () => {
    const request = buildMeasurementProtocolRequest(event, "G-TEST123", "api-secret");

    expect(request.url).toBe("https://www.google-analytics.com/mp/collect?measurement_id=G-TEST123&api_secret=api-secret");
    expect(request.body).toEqual({
      client_id: "client-1",
      events: [{
        name: "mh_qr_scan",
        params: {
          mh_link_key: "link-1",
          mh_local_event_id: "event-1",
          engagement_time_msec: 1,
        },
      }],
    });
    expect(JSON.stringify(request.body)).not.toContain("api-secret");
  });

  it("treats a successful HTTP receipt as received", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(sendMeasurementProtocolEvent(event, { measurementId: "G-TEST123", apiSecret: "secret" }, fetcher)).resolves.toEqual({ kind: "received" });
  });

  it("distinguishes permanent payload errors from uncertain transport failures", async () => {
    const invalidPayload = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    const unavailable = vi.fn().mockResolvedValue(new Response("retry", { status: 503 }));

    await expect(sendMeasurementProtocolEvent(event, { measurementId: "G-TEST123", apiSecret: "secret" }, invalidPayload)).rejects.toMatchObject({ kind: "failed" });
    await expect(sendMeasurementProtocolEvent(event, { measurementId: "G-TEST123", apiSecret: "secret" }, unavailable)).rejects.toMatchObject({ kind: "uncertain" });
  });
});
