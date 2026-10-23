import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ processGa4Outbox: vi.fn() }));

vi.mock("@/lib/env", () => ({ env: { GA4_JOB_SECRET: "test-secret" } }));
vi.mock("@/modules/analytics", () => ({ processGa4Outbox: mocks.processGa4Outbox }));

import { POST } from "./route";

function requestWithAuth(authorization?: string): NextRequest {
  return {
    headers: { get: (key: string) => key === "authorization" ? authorization ?? null : null },
  } as unknown as NextRequest;
}

describe("POST /api/jobs/ga4", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.processGa4Outbox.mockResolvedValue({ disabled: false, claimed: 1, received: 1, failed: 0, uncertain: 0 });
  });

  afterAll(() => vi.restoreAllMocks());

  it("rejects an invalid bearer token", async () => {
    const response = await POST(requestWithAuth("Bearer wrong"));

    expect(response.status).toBe(401);
    expect(mocks.processGa4Outbox).not.toHaveBeenCalled();
  });

  it("processes the outbox with a valid bearer token", async () => {
    const response = await POST(requestWithAuth("Bearer test-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, disabled: false, claimed: 1, received: 1, failed: 0, uncertain: 0 });
  });
});
