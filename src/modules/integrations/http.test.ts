import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateHcsToken: vi.fn(),
  getOrganization: vi.fn(),
}));

vi.mock("./service", () => ({ authenticateHcsToken: mocks.authenticateHcsToken }));
vi.mock("@/modules/users", () => ({ getOrganization: mocks.getOrganization }));

import { authenticateHcsRequest, errorResponse, HcsHttpError } from "./http";

function requestWith(authorization?: string, companyId?: string): NextRequest {
  return { headers: { get: (key: string) => key === "authorization" ? authorization ?? null : key === "x-hcs-company-id" ? companyId ?? null : null } } as unknown as NextRequest;
}

describe("HCS HTTP authentication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateHcsToken.mockResolvedValue({ id: "connection-1", organizationId: "org-1", hcsCompanyId: "company-1" });
    mocks.getOrganization.mockResolvedValue({ id: "org-1", name: "Acme" });
  });

  it("requires a bearer token and company header", async () => {
    await expect(authenticateHcsRequest(requestWith(undefined, "company-1"))).rejects.toMatchObject({ status: 401 });
    await expect(authenticateHcsRequest(requestWith("Bearer token", undefined))).rejects.toMatchObject({ status: 401 });
  });

  it("authenticates only with the supplied company scope", async () => {
    await authenticateHcsRequest(requestWith("Bearer token", "company-1"));

    expect(mocks.authenticateHcsToken).toHaveBeenCalledWith("token", "company-1");
  });

  it("returns 403 for company mismatch and organization denial", async () => {
    mocks.authenticateHcsToken.mockRejectedValueOnce(new Error("Token/company mismatch"));
    await expect(authenticateHcsRequest(requestWith("Bearer token", "company-2"))).rejects.toMatchObject({ status: 403 });

    mocks.getOrganization.mockResolvedValueOnce(undefined);
    await expect(authenticateHcsRequest(requestWith("Bearer token", "company-1"))).rejects.toMatchObject({ status: 403 });
  });

  it("preserves the generic error body for conflict and rate-limit statuses", async () => {
    for (const status of [409, 429] as const) {
      const response = errorResponse(new HcsHttpError(status));
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error: "Request could not be processed" });
    }
  });
});
