import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const processDueEmailCampaigns = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: { MARKETING_HUB_SERVER_TOKEN: "test-secret" } }));
vi.mock("@/modules/email-marketing", () => ({ processDueEmailCampaigns }));

import { POST } from "./route";

function requestWithAuth(authorization?: string): NextRequest {
  return {
    headers: { get: (key: string) => (key === "authorization" ? authorization ?? null : null) },
  } as unknown as NextRequest;
}

describe("POST /api/jobs/email-campaigns", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    processDueEmailCampaigns.mockResolvedValue({ claimed: 1, sent: 2, failed: 0 });
  });

  afterAll(() => vi.restoreAllMocks());

  it("rejects requests without the marketing job token", async () => {
    const response = await POST(requestWithAuth("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(processDueEmailCampaigns).not.toHaveBeenCalled();
  });

  it("returns processing counts so the cron history is meaningful", async () => {
    const response = await POST(requestWithAuth("Bearer test-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, claimed: 1, sent: 2, failed: 0 });
  });
});
