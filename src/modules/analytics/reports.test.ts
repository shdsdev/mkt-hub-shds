import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    GA4_PROPERTY_ID: "123456789",
    GA4_SERVICE_ACCOUNT_EMAIL: "reader@example.iam.gserviceaccount.com",
    GA4_SERVICE_ACCOUNT_PRIVATE_KEY: "private-key",
  },
}));
vi.mock("./google", () => ({
  runGa4Report: vi.fn().mockResolvedValue({
    rows: [{ metricValues: [{ value: "12" }, { value: "8" }, { value: "10" }] }],
  }),
}));

import { getGa4MetricsForLink, getGa4MetricsForOrganization } from "./reports";

describe("GA4 reports", () => {
  it("maps Data API metric values into a dashboard-safe summary", async () => {
    await expect(getGa4MetricsForLink("link-1", "qr_scan", "2026-10-01", "2026-10-23")).resolves.toEqual({
      configured: true,
      eventCount: 12,
      activeUsers: 8,
      sessions: 10,
      available: true,
    });
  });

  it("requires an authorized link set for organization reports", async () => {
    await expect(getGa4MetricsForOrganization("qr_scan", "2026-10-01", "2026-10-23", "org-1", [])).resolves.toMatchObject({
      configured: true,
      available: true,
      eventCount: 0,
    });
  });
});
