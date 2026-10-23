import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createConsentToken: vi.fn(),
  cancelGa4OutboxForClient: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    ANALYTICS_CONSENT_SECRET: "test-secret",
  },
}));
vi.mock("@/modules/analytics", () => ({
  ANALYTICS_CONSENT_COOKIE: "mh_analytics_consent",
  createConsentToken: mocks.createConsentToken,
  cancelGa4OutboxForClient: mocks.cancelGa4OutboxForClient,
  getAnalyticsConsentState: vi.fn().mockReturnValue(undefined),
  setAnalyticsConsentCookie: (response: Response, token: string) => {
    response.headers.set("set-cookie", `mh_analytics_consent=${token}; Max-Age=15552000`);
  },
}));

import { DELETE, GET, POST } from "./route";

function request(body: unknown): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

describe("analytics consent route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.createConsentToken.mockReturnValue("signed-token");
  });

  afterAll(() => vi.restoreAllMocks());

  it("sets a server-verifiable cookie for valid consent", async () => {
    const response = await POST(request({ state: "granted" }));

    expect(response.status).toBe(204);
    expect(mocks.createConsentToken).toHaveBeenCalledWith("granted", expect.any(Date), "test-secret");
    expect(response.headers.get("set-cookie")).toContain("mh_analytics_consent=signed-token");
  });

  it("reports the server-side consent state", async () => {
    const response = await GET({ cookies: { get: () => undefined } } as unknown as NextRequest);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: undefined });
  });

  it("rejects invalid consent states", async () => {
    const response = await POST(request({ state: "maybe" }));

    expect(response.status).toBe(400);
    expect(mocks.createConsentToken).not.toHaveBeenCalled();
  });

  it("clears consent when the user withdraws it", async () => {
    const response = await DELETE(request({}));

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("mh_analytics_consent=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
